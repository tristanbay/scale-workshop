import { computed, ref, watch, type Ref } from 'vue'
import { defineStore } from 'pinia'
import { useStateStore } from './state'
import {
  APERIODIC_WAVEFORMS,
  APERIODIC_WAVES,
  BASIC_WAVEFORMS,
  CUSTOM_WAVEFORMS,
  PERIODIC_WAVES,
  ENV_PRESET_ORGAN,
  ENV_PRESET_PAD,
  ENV_PRESET_SHORT,
  ENV_PRESET_MEDIUM,
  ENV_PRESET_LONG,
  DLY_PRESET_MONO,
  DLY_PRESET_STEREO,
  DLY_PRESET_INTENSE,
  DLY_PRESET_ELASTIC,
  DLY_PRESET_AMBIENT,
  initializeCustomWaves,
  PingPongDelay
} from '../synth'
import { VirtualSynth } from '../virtual-synth'
import {
  AperiodicSynth,
  Synth,
  UnisonSynth,
  type OscillatorVoiceParams,
  type UnisonVoiceParams,
  type VoiceBaseParams,
  type AperiodicVoiceParams,
  AperiodicWave
} from 'sw-synth'

const state = useStateStore()

// The compiler chokes on this store so we need an explicit type annotation
type AudioStore = {
  initialize: () => void
  uninitialize: () => Promise<void>
  toJSON: () => any
  fromJSON: (data: any) => void
  context: Ref<AudioContext>
  mainVolume: Ref<number>
  waveform: Ref<string>
  attackTime: Ref<number>
  decayTime: Ref<number>
  sustainLevel: Ref<number>
  releaseTime: Ref<number>
  stackSize: Ref<number>
  spread: Ref<number>
  aperiodicWaveform: Ref<string>
  audioDelay: Ref<number>
  maxPolyphony: Ref<number>
  synth: Ref<Synth | UnisonSynth | AperiodicSynth | null>
  synthType: Ref<'none' | 'oscillator' | 'unison' | 'aperiodic'>
  virtualSynth: Ref<VirtualSynth>
  pingPongDelay: Ref<PingPongDelay>
  pingPongDelayTime: Ref<number>
  pingPongFeedback: Ref<number>
  pingPongGain: Ref<number>
  pingPongSeparation: Ref<number>
  mainGain: Ref<GainNode>
  mainLowpass: Ref<BiquadFilterNode>
  mainHighpass: Ref<BiquadFilterNode>
}

export const useAudioStore = defineStore<'audio', AudioStore>('audio', () => {
  const context = ref<AudioContext | null>(null)
  // Chromium has some issues with audio nodes as props
  // so we need this extra ref and the associated watcher.
  const mainVolume = ref(0.18)
  // Protect the user's audio system by limiting
  // the gain and frequency response.
  const mainGain = ref<GainNode | null>(null)
  const mainLowpass = ref<BiquadFilterNode | null>(null)
  const mainHighpass = ref<BiquadFilterNode | null>(null)
  const synth = ref<Synth | UnisonSynth | AperiodicSynth | null>(null)
  const synthType = ref<'none' | 'oscillator' | 'unison' | 'aperiodic'>('none')

  // One of these gets swapped in the ref.
  let oscillatorSynth: Synth
  let unisonSynth: UnisonSynth
  let aperiodicSynth: AperiodicSynth

  // Synth params
  const waveform = ref(state.defaultWaveform)
  const attackTime = ref(
    state.defaultEnvelope == 'organ' ? ENV_PRESET_ORGAN[0] :
    (state.defaultEnvelope == 'pad' ? ENV_PRESET_PAD[0] :
    (state.defaultEnvelope == 'short' ? ENV_PRESET_SHORT[0] :
    (state.defaultEnvelope == 'medium' ? ENV_PRESET_MEDIUM[0] :
    ENV_PRESET_LONG[0])))
  )
  const decayTime = ref(
    state.defaultEnvelope == 'organ' ? ENV_PRESET_ORGAN[1] :
    (state.defaultEnvelope == 'pad' ? ENV_PRESET_PAD[1] :
    (state.defaultEnvelope == 'short' ? ENV_PRESET_SHORT[1] :
    (state.defaultEnvelope == 'medium' ? ENV_PRESET_MEDIUM[1] :
    ENV_PRESET_LONG[1])))
  )
  const sustainLevel = ref(
    state.defaultEnvelope == 'organ' ? ENV_PRESET_ORGAN[2] :
    (state.defaultEnvelope == 'pad' ? ENV_PRESET_PAD[2] :
    (state.defaultEnvelope == 'short' ? ENV_PRESET_SHORT[2] :
    (state.defaultEnvelope == 'medium' ? ENV_PRESET_MEDIUM[2] :
    ENV_PRESET_LONG[2])))
  )
  const releaseTime = ref(
    state.defaultEnvelope == 'organ' ? ENV_PRESET_ORGAN[3] :
    (state.defaultEnvelope == 'pad' ? ENV_PRESET_PAD[3] :
    (state.defaultEnvelope == 'short' ? ENV_PRESET_SHORT[3] :
    (state.defaultEnvelope == 'medium' ? ENV_PRESET_MEDIUM[3] :
    ENV_PRESET_LONG[3])))
  )
  const stackSize = ref(state.defaultUnisonStackSize)
  const spread = ref(state.defaultUnisonSpread)
  const aperiodicWaveform = ref(state.defaultAperiodicWaveform)
  // Fix Firefox issues with audioContext.currentTime being in the past using a delay.
  // This is a locally stored user preference, but shown on the Synth tab.
  const audioDelay = ref(0.001)

  // A virtual synth is used to "play" the chord wheels in the Analysis tab.
  const virtualSynth = ref<VirtualSynth | null>(null)

  // Stereo ping pong delay and associated params
  const pingPongDelay = ref<PingPongDelay | null>(null)
  const pingPongGainNode = ref<GainNode | null>(null)
  const pingPongDelayTime = ref(
    (state.defaultDelay == 'mono' || state.defaultDelay == 'off') ? DLY_PRESET_MONO[0] :
    (state.defaultDelay == 'stereo' ? DLY_PRESET_STEREO[0] :
    (state.defaultDelay == 'intense' ? DLY_PRESET_INTENSE[0] :
    (state.defaultDelay == 'elastic' ? DLY_PRESET_ELASTIC[0] :
    DLY_PRESET_AMBIENT[0])))
  )
  const pingPongFeedback = ref(
    (state.defaultDelay == 'mono' || state.defaultDelay == 'off') ? DLY_PRESET_MONO[1] :
    (state.defaultDelay == 'stereo' ? DLY_PRESET_STEREO[1] :
    (state.defaultDelay == 'intense' ? DLY_PRESET_INTENSE[1] :
    (state.defaultDelay == 'elastic' ? DLY_PRESET_ELASTIC[1] :
    DLY_PRESET_AMBIENT[1])))
  )
  const pingPongSeparation = ref(
    (state.defaultDelay == 'mono' || state.defaultDelay == 'off') ? DLY_PRESET_MONO[2] :
    (state.defaultDelay == 'stereo' ? DLY_PRESET_STEREO[2] :
    (state.defaultDelay == 'intense' ? DLY_PRESET_INTENSE[2] :
    (state.defaultDelay == 'elastic' ? DLY_PRESET_ELASTIC[2] :
    DLY_PRESET_AMBIENT[2])))
  )
  const pingPongGain = ref(
    state.defaultDelay == 'mono' ? DLY_PRESET_MONO[3] :
    (state.defaultDelay == 'stereo' ? DLY_PRESET_STEREO[3] :
    (state.defaultDelay == 'intense' ? DLY_PRESET_INTENSE[3] :
    (state.defaultDelay == 'elastic' ? DLY_PRESET_ELASTIC[3] :
    (state.defaultDelay == 'ambient' ? DLY_PRESET_AMBIENT[3] :
    0.0))))
  )

  // Fetch user-specific states
  if ('audioDelay' in window.localStorage) {
    const value = window.localStorage.getItem('audioDelay')
    if (value !== null) {
      audioDelay.value = parseFloat(value)
      if (isNaN(audioDelay.value)) {
        audioDelay.value = 0.001
      }
    }
  }

  const _voiceBase: VoiceBaseParams = {
    audioDelay: audioDelay.value,
    attackTime: attackTime.value,
    decayTime: decayTime.value,
    sustainLevel: sustainLevel.value,
    releaseTime: releaseTime.value
  }

  const oscillatorVoiceParams: OscillatorVoiceParams = {
    ..._voiceBase,
    type: 'triangle',
    periodicWave: undefined
  }

  const unisonVoiceParams: UnisonVoiceParams = {
    ...oscillatorVoiceParams,
    spread: spread.value,
    stackSize: stackSize.value
  }

  const aperiodicVoiceParams: AperiodicVoiceParams = {
    ..._voiceBase,
    aperiodicWave: null as unknown as AperiodicWave // Pacifies the type checker. Set properly during init.
  }

  const maxPolyphony = computed({
    get() {
      if (synth.value === null) {
        if ('maxPolyphony' in window.localStorage) {
          return parseInt(window.localStorage.getItem('maxPolyphony')!)
        }
        return 6
      }
      return synth.value.maxPolyphony
    },
    set(newValue) {
      if (newValue < 1) {
        newValue = 1
      }
      if (newValue > 128) {
        newValue = 128
      }
      if (!isNaN(newValue)) {
        newValue = Math.round(newValue)
        window.localStorage.setItem('maxPolyphony', newValue.toString())
        if (synth.value !== null) {
          synth.value.setPolyphony(newValue)
        }
      }
    }
  })

  function initialize() {
    if (context.value) {
      context.value.resume()
      return
    }
    context.value = new AudioContext({ latencyHint: 'interactive' })

    pingPongDelay.value = new PingPongDelay(context.value)
    pingPongGainNode.value = context.value.createGain()
    pingPongDelay.value.delayTime = pingPongDelayTime.value
    pingPongDelay.value.feedback = pingPongFeedback.value
    pingPongDelay.value.separation = pingPongFeedback.value
    pingPongGainNode.value.gain.setValueAtTime(pingPongGain.value, context.value.currentTime)

    const gain = context.value.createGain()
    gain.gain.setValueAtTime(mainVolume.value, context.value.currentTime)
    gain.connect(context.value.destination)
    gain.connect(pingPongDelay.value.destination)
    pingPongDelay.value.connect(pingPongGainNode.value).connect(context.value.destination)
    mainGain.value = gain

    const lowpass = context.value.createBiquadFilter()
    lowpass.frequency.setValueAtTime(5000, context.value.currentTime)
    lowpass.Q.setValueAtTime(Math.sqrt(0.5), context.value.currentTime)
    lowpass.type = 'lowpass'
    lowpass.connect(gain)
    mainLowpass.value = lowpass

    const highpass = context.value.createBiquadFilter()
    highpass.frequency.setValueAtTime(30, context.value.currentTime)
    highpass.Q.setValueAtTime(Math.sqrt(0.5), context.value.currentTime)
    highpass.type = 'highpass'
    highpass.connect(lowpass)
    mainHighpass.value = highpass

    // Intended point of audio connection
    const audioDestination = highpass

    initializeCustomWaves(context.value)

    oscillatorVoiceParams.type = 'custom'
    oscillatorVoiceParams.periodicWave = PERIODIC_WAVES[state.defaultWaveform].value
    unisonVoiceParams.type = 'custom'
    unisonVoiceParams.periodicWave = PERIODIC_WAVES[state.defaultWaveform].value
    aperiodicVoiceParams.aperiodicWave = APERIODIC_WAVES[state.defaultAperiodicWaveform].value

    // These all should start with polyphony 0 to save resources
    oscillatorSynth = new Synth(context.value, audioDestination)
    unisonSynth = new UnisonSynth(context.value, audioDestination)
    aperiodicSynth = new AperiodicSynth(context.value, audioDestination)

    // The content of these references will be manipulated in-place
    oscillatorSynth.voiceParams = oscillatorVoiceParams
    unisonSynth.voiceParams = unisonVoiceParams
    aperiodicSynth.voiceParams = aperiodicVoiceParams

    const storedMaxPolyphony = maxPolyphony.value

    // load default synth type in from settings
    synthType.value = 'oscillator'
    const value = state.defaultSynthType
    switch (value) {
      case 'unison':
        synthType.value = 'unison'
        break
      case 'aperiodic':
        synthType.value = 'aperiodic'
        break
      default:
        break
    }
    switch (synthType.value) {
      case 'unison':
        synth.value = unisonSynth
        break
      case 'aperiodic':
        synth.value = aperiodicSynth
        break
      default:
        synth.value = oscillatorSynth
        break
    }
    synth.value.maxPolyphony = storedMaxPolyphony

    virtualSynth.value = new VirtualSynth(context.value)
  }

  async function uninitialize() {
    if (!context.value) {
      return
    }
    if (mainGain.value) {
      mainGain.value.disconnect()
    }
    if (mainLowpass.value) {
      mainLowpass.value.disconnect()
    }
    if (mainHighpass.value) {
      mainHighpass.value.disconnect()
    }
    if (synth.value) {
      synth.value.setPolyphony(0)
    }
    await context.value.close()
    context.value = null
  }

  watch(mainVolume, (newValue) => {
    if (!context.value || !mainGain.value) {
      return
    }
    mainGain.value.gain.setValueAtTime(newValue, context.value.currentTime)
  })

  watch(audioDelay, (newValue) => {
    window.localStorage.setItem('audioDelay', newValue.toString())
    oscillatorVoiceParams.audioDelay = newValue
    unisonVoiceParams.audioDelay = newValue
    aperiodicVoiceParams.audioDelay = newValue
  })

  watch(synthType, (newValue) => {
    const storedMaxPolyphony = maxPolyphony.value
    switch (newValue) {
      case 'none':
        synth.value = null
        oscillatorSynth.maxPolyphony = 0
        unisonSynth.maxPolyphony = 0
        aperiodicSynth.maxPolyphony = 0
        break
      case 'oscillator':
        synth.value = oscillatorSynth
        oscillatorSynth.maxPolyphony = storedMaxPolyphony
        unisonSynth.maxPolyphony = 0
        aperiodicSynth.maxPolyphony = 0
        break
      case 'unison':
        synth.value = unisonSynth
        oscillatorSynth.maxPolyphony = 0
        unisonSynth.maxPolyphony = storedMaxPolyphony
        aperiodicSynth.maxPolyphony = 0
        break
      case 'aperiodic':
        synth.value = aperiodicSynth
        oscillatorSynth.maxPolyphony = 0
        unisonSynth.maxPolyphony = 0
        aperiodicSynth.maxPolyphony = storedMaxPolyphony
        break
    }
  })

  watch(waveform, (newValue) => {
    if (BASIC_WAVEFORMS.includes(newValue)) {
      oscillatorVoiceParams.type = unisonVoiceParams.type = newValue as any
      oscillatorVoiceParams.periodicWave = unisonVoiceParams.periodicWave = undefined
    } else if (CUSTOM_WAVEFORMS.includes(newValue)) {
      oscillatorVoiceParams.type = unisonVoiceParams.type = 'custom'
      oscillatorVoiceParams.periodicWave = unisonVoiceParams.periodicWave =
        PERIODIC_WAVES[newValue].value
    }
  })

  watch(aperiodicWaveform, (newValue) => {
    if (APERIODIC_WAVEFORMS.includes(newValue)) {
      aperiodicVoiceParams.aperiodicWave = APERIODIC_WAVES[newValue].value
    }
  })

  watch(attackTime, (newValue) => {
    oscillatorVoiceParams.attackTime =
      unisonVoiceParams.attackTime =
      aperiodicVoiceParams.attackTime =
        newValue
  })

  watch(decayTime, (newValue) => {
    oscillatorVoiceParams.decayTime =
      unisonVoiceParams.decayTime =
      aperiodicVoiceParams.decayTime =
        newValue
  })

  watch(sustainLevel, (newValue) => {
    oscillatorVoiceParams.sustainLevel =
      unisonVoiceParams.sustainLevel =
      aperiodicVoiceParams.sustainLevel =
        newValue
  })

  watch(releaseTime, (newValue) => {
    oscillatorVoiceParams.releaseTime =
      unisonVoiceParams.releaseTime =
      aperiodicVoiceParams.releaseTime =
        newValue
  })

  watch(stackSize, (newValue) => {
    unisonVoiceParams.stackSize = newValue
  })

  watch(spread, (newValue) => {
    unisonVoiceParams.spread = newValue
  })

  // Ping pong delay parameter watchers
  watch(pingPongDelayTime, (newValue) => {
    if (!pingPongDelay.value) {
      return
    }
    pingPongDelay.value.delayTime = newValue
  })
  watch(pingPongFeedback, (newValue) => {
    if (!pingPongDelay.value) {
      return
    }
    pingPongDelay.value.feedback = newValue
  })
  watch(pingPongSeparation, (newValue) => {
    if (!pingPongDelay.value) {
      return
    }
    pingPongDelay.value.separation = newValue
  })
  watch(pingPongGain, (newValue) => {
    if (!pingPongGainNode.value || !context.value) {
      return
    }
    pingPongGainNode.value.gain.setValueAtTime(newValue, context.value.currentTime)
  })

  const LIVE_STATE = {
    mainVolume,
    waveform,
    attackTime,
    decayTime,
    sustainLevel,
    releaseTime,
    stackSize,
    spread,
    aperiodicWaveform,
    synthType,
    pingPongDelayTime,
    pingPongFeedback,
    pingPongGain,
    pingPongSeparation
  }

  /**
   * Convert live state to a format suitable for storing on the server.
   */
  function toJSON() {
    const result: any = {}
    for (const [key, value] of Object.entries(LIVE_STATE)) {
      result[key] = value.value
    }
    return result
  }

  /**
   * Apply revived state to current state.
   * @param data JSON data as an Object instance.
   */
  function fromJSON(data: any) {
    for (const key in LIVE_STATE) {
      LIVE_STATE[key as keyof typeof LIVE_STATE].value = data[key]
    }
  }

  return {
    // Methods
    initialize,
    uninitialize,
    toJSON,
    fromJSON,

    // Live state
    ...LIVE_STATE,
    // Persistent state
    audioDelay,
    // Other public state
    context,
    maxPolyphony,
    synth,
    virtualSynth,
    pingPongDelay,
    // "Private" state must be exposed for Pinia
    mainGain,
    mainLowpass,
    mainHighpass
  } as AudioStore
})
