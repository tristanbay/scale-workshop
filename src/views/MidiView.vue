<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { Input, Output, WebMidi, type NoteMessageEvent, type MessageEvent } from 'webmidi'
import MidiPiano from '@/components/MidiPiano.vue'
import { useMidiStore } from '@/stores/midi'
import { useScaleStore } from '@/stores/scale'

const props = defineProps<{
  midiInputChannels: Set<number>
}>()

const scale = useScaleStore()
const midi = useMidiStore()

const inputs = reactive<Input[]>([])
const outputs = reactive<Output[]>([])
const inputHighlights = reactive<Set<number>>(new Set())
const stopHighlights = ref<() => void>(() => {})

const activeKeys = reactive<Set<number>>(new Set())
const stopActivations = ref<() => void>(() => {})

function highlightMidiChannel(event: MessageEvent) {
  inputHighlights.add(event.message.channel)
  setTimeout(() => inputHighlights.delete(event.message.channel), 500)
}

function activateKey(event: NoteMessageEvent) {
  if (props.midiInputChannels.has(event.message.channel)) {
    activeKeys.add(event.note.number)
  }
}

function deactivateKey(event: NoteMessageEvent) {
  if (props.midiInputChannels.has(event.message.channel)) {
    activeKeys.delete(event.note.number)
  }
}

function selectMidiInput(event: Event) {
  const id = (event!.target as HTMLSelectElement).value
  stopHighlights.value()
  if (id === 'no-midi-input') {
    midi.input = null
    stopHighlights.value = () => {}
  } else {
    const input = WebMidi.getInputById(id)
    midi.input = input
    input.addListener('midimessage', highlightMidiChannel)
    stopHighlights.value = () => input.removeListener('midimessage', highlightMidiChannel)
  }
  stopActivations.value()
  if (id === 'no-midi-input') {
    stopActivations.value = () => {}
  } else {
    const input = WebMidi.getInputById(id)
    input.addListener('noteon', activateKey)
    input.addListener('noteoff', deactivateKey)
    stopActivations.value = () => {
      input.removeListener('noteon', activateKey)
      input.removeListener('noteoff', deactivateKey)
    }
  }
}

function selectMidiOutput(event: Event) {
  const id = (event!.target as HTMLSelectElement).value
  if (id === 'no-midi-output') {
    midi.output = null
  } else {
    midi.output = WebMidi.getOutputById(id)!
  }
}

function refreshMidi() {
  while (inputs.length) {
    inputs.pop()
  }
  WebMidi.inputs.forEach((input) => inputs.push(input))

  while (outputs.length) {
    outputs.pop()
  }
  WebMidi.outputs.forEach((output) => outputs.push(output))
}

function toggleChannel(
  event: Event,
  prop: Set<number>,
  eventStr: 'update:midiInputChannels' | 'update:midiOutputChannels'
) {
  const checkbox = event.target as HTMLInputElement
  const channel = parseInt(checkbox.value)

  const result = new Set(prop)
  if (checkbox.checked) {
    result.add(channel)
  } else {
    result.delete(channel)
  }
  if (eventStr === 'update:midiInputChannels') {
    props.midiInputChannels.clear()
    for (const channel of result) {
      props.midiInputChannels.add(channel)
    }
  } else {
    midi.outputChannels = result
  }
}

const toggleInputChannel = (event: Event) =>
  toggleChannel(event, props.midiInputChannels, 'update:midiInputChannels')
const toggleOutputChannel = (event: Event) =>
  toggleChannel(event, midi.outputChannels, 'update:midiOutputChannels')

onMounted(async () => {
  await WebMidi.enable()
  refreshMidi()

  const existingOnStateChange = WebMidi.interface.onstatechange
  WebMidi.interface.onstatechange = (e) => {
    existingOnStateChange(e)
    // XXX: Webmidi doesn't expose this state change correctly so we'll have to use a time out hack.
    setTimeout(refreshMidi, 500)
  }

  if (midi.input !== null) {
    const input = midi.input
    input.addListener('midimessage', highlightMidiChannel)
    stopHighlights.value = () => input.removeListener('midimessage', highlightMidiChannel)

    input.addListener('noteon', activateKey)
    input.addListener('noteoff', deactivateKey)
    stopActivations.value = () => {
      input.removeListener('noteon', activateKey)
      input.removeListener('noteoff', deactivateKey)
    }
  }
})

onUnmounted(() => {
  stopHighlights.value()
  stopActivations.value()
})

function selectAllInputChannels() {
  for (let i = 1; i <= 16; ++i) {
    props.midiInputChannels.add(i)
  }
}

function unselectAllInputChannels() {
  props.midiInputChannels.clear()
}

watch(
  () => midi.multichannelToEquave,
  (newValue) => {
    if (newValue) {
      selectAllInputChannels()
    } else {
      unselectAllInputChannels()
      props.midiInputChannels.add(1)
    }
  }
)
</script>

<template>
  <main>
    <div class="columns-container">
      <div class="column midi-controls">
        <h2>MIDI Input</h2>
        <div class="control-group">
          <div class="control">
            <label for="input">Input device</label>
            <select id="input" @change="selectMidiInput" class="control">
              <option value="no-midi-input" :selected="midi.input === null">No MIDI input</option>
              <option
                v-for="input of inputs"
                :value="input.id"
                :key="input.id"
                :selected="input.id === midi.input?.id"
              >
                {{ (input.manufacturer || '(Generic)') + ': ' + input.name }}
              </option>
            </select>
          </div>
          <div class="control channels-wrapper">
            <label>Input channels</label>
            <span v-for="channel in 16" :key="channel">
              <label :class="{ active: inputHighlights.has(channel) }">{{ channel }}</label>
              <input
                type="checkbox"
                :value="channel"
                :checked="midiInputChannels.has(channel)"
                @input="toggleInputChannel"
              />
            </span>
          </div>
          <div class="btn-group">
            <button @click="selectAllInputChannels">Select all</button>
            <button @click="unselectAllInputChannels">Select none</button>
          </div>
          <div class="control checkbox-group">
            <div>
              <input type="checkbox" id="midi-velocity" v-model="midi.velocityOn" />
              <label for="midi-velocity">Use velocity</label>
            </div>
            <div>
              <input type="checkbox" id="multichannel" v-model="midi.multichannelToEquave" />
              <label for="multichannel">Multichannel-to-equave</label>
            </div>
          </div>
          <template v-if="midi.multichannelToEquave">
            <label>Settings for multichannel-to-equave mode</label>
            <div class="control multichannel-input-container">
              <div>
                Center channel
                <input
                  id="multichannel-center"
                  class="control"
                  type="number"
                  min="1"
                  max="16"
                  v-model="midi.multichannelCenter"
                />
              </div>
              <div>
                Total equaves
                <input
                  id="multichannel-num-equaves"
                  class="control"
                  type="number"
                  min="1"
                  max="16"
                  v-model="midi.multichannelNumEquaves"
                />
              </div>
              <div>
                Equaves down
                <input
                  id="multichannel-equaves-down"
                  class="control"
                  type="number"
                  min="0"
                  max="15"
                  v-model="midi.multichannelEquavesDown"
                />
              </div>
            </div>
          </template>
          <template v-if="!midi.multichannelToEquave">
            <div class="control radio-group">
              <label>Color mapping</label>
              <span>
                <input type="radio" id="white-off" value="off" v-model="midi.whiteMode" />
                <label for="white-off">Chromatic</label>
              </span>
              <span>
                <input type="radio" id="white-simple" value="simple" v-model="midi.whiteMode" />
                <label for="white-simple">White only</label>
              </span>
              <span>
                <input
                  type="radio"
                  id="white-black"
                  value="blackAverage"
                  v-model="midi.whiteMode"
                />
                <label for="white-black">White w/ interpolation</label>
              </span>
              <span>
                <input type="radio" id="white-color" value="keyColors" v-model="midi.whiteMode" />
                <label for="white-color">White key to white color</label>
              </span>
            </div>
          </template>
        </div>
        <div class="piano-container">
          <MidiPiano
            :whiteModeOffset="scale.whiteModeOffset"
            :baseMidiNote="scale.baseMidiNote"
            :midiWhiteMode="midi.whiteMode"
            :multichannel="midi.multichannelToEquave"
            :keyColors="scale.colors"
            :activeKeys="activeKeys"
          />
        </div>
      </div>
      <div class="column midi-controls">
        <h2>MIDI Output</h2>
        <div class="control-group">
          <div class="control">
            <label for="output">Output device</label>
            <select id="output" @change="selectMidiOutput" class="control">
              <option value="no-midi-output" :selected="midi.output === null">
                No MIDI output
              </option>
              <option
                v-for="output of outputs"
                :value="output.id"
                :key="output.id"
                :selected="output.id === midi.output?.id"
              >
                {{ (output.manufacturer || '(Generic)') + ': ' + output.name }}
              </option>
            </select>
          </div>
          <div class="control radio-group">
            <label>Output mode</label>
            <span>
              <input
                type="radio"
                id="output-pitch-bend"
                value="pitchBend"
                v-model="midi.outputMode"
              />
              <label for="output-pitch-bend">12-TET w/ multichannel pitch bend</label>
            </span>
            <span>
              <input type="radio" id="output-linear" value="linear" v-model="midi.outputMode" />
              <label for="output-linear">Linear (use "#" column)</label>
            </span>
          </div>
          <div class="control channels-wrapper" v-if="midi.outputMode === 'pitchBend'">
            <label>Output channels</label>
            <span v-for="channel in 16" :key="channel">
              <label>{{ channel }}</label>
              <input
                type="checkbox"
                :value="channel"
                :checked="midi.outputChannels.has(channel)"
                @input="toggleOutputChannel"
              />
            </span>
          </div>
          <div class="control" v-else>
            <label>Output channel</label>
            <input type="number" step="1" min="1" max="16" v-model="midi.outputChannel" />
          </div>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
/* Content layout */
div.columns-container {
  height: 100%;
  overflow-y: auto;
}
div.column {
  overflow-x: hidden;
}

@media screen and (min-width: 600px) {
  div.columns-container {
    background-color: var(--color-border);
    column-count: 2;
    column-gap: 1px;
    height: 100%;
  }
  div.column {
    background-color: var(--color-background);
    height: 100%;
    overflow-y: auto;
  }
}

div.midi-controls {
  padding: 1rem;
}

div.channels-wrapper {
  column-gap: 1rem;
  margin-bottom: 1rem;
}

div.channels-wrapper span {
  display: flex;
  flex-flow: column;
  text-align: center;
}

div.checkbox-group {
  flex-flow: unset;
  gap: 0.15rem 1rem;
}

div.checkbox-group label {
  font-weight: normal;
  margin-left: 0.35rem;
  text-align: left;
  vertical-align: baseline;
}

div.multichannel-input-container {
  gap: 0.15rem 1rem;
}

.active {
  background-color: greenyellow;
}
div.piano-container {
  height: 50%;
}
</style>
