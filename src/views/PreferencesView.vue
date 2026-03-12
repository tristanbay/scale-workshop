<script setup lang="ts">
import { UNIX_NEWLINE, WINDOWS_NEWLINE } from '@/constants'
import { APERIODIC_WAVEFORMS, WAVEFORMS } from '@/synth'

import { useStateStore } from '@/stores/state'
import { useScaleStore } from '@/stores/scale'

const state = useStateStore()
const scale = useScaleStore()
</script>

<template>
  <main>
    <div class="columns-container">
      <div class="column">
        <h2>File export</h2>
        <div class="control-group">
          <div class="control">
            <label for="newline">Line endings format</label>
            <select
              id="newline"
              class="control"
              title="If your exported tuning files didn't work right on macOS synths, try changing this option to Unix."
              v-model="state.newline"
            >
              <option :value="WINDOWS_NEWLINE">Microsoft (Windows/MS-DOS)</option>
              <option :value="UNIX_NEWLINE">Unix (Mac/Linux)</option>
            </select>
          </div>
        </div>
        <h2>QWERTY layout</h2>
        <div class="control-group">
          <div class="control checkbox-container">
            <input id="has-left-of-z" type="checkbox" v-model="scale.hasLeftOfZ" />
            <label for="has-left-of-z" class="right-of-checkbox"
              >There's a key between left Shift and 'Z'</label
            >
          </div>
        </div>
        <h2>Advanced</h2>
        <div class="control-group">
          <div class="control checkbox-container">
            <input id="mos-tab" type="checkbox" v-model="state.showMosTab" />
            <label for="mos-tab" class="right-of-checkbox">MOS tab in top menu</label>
          </div>
          <div class="control checkbox-container">
            <input id="virtual-qwerty" type="checkbox" v-model="state.showVirtualQwerty" />
            <label for="virtual-qwerty" class="right-of-checkbox">Virtual QWERTY in top menu</label>
          </div>
          <div class="control">
            <label for="gas">Computational budget (gas)</label>
            <input id="gas" type="number" min="1" v-model="scale.gas" />
          </div>
          <div class="control checkbox-container">
            <input id="debug" type="checkbox" v-model="state.debug" />
            <label for="debug" class="right-of-checkbox">Enable debugging features</label>
          </div>
        </div>
      </div>
      <div class="column">
        <h2>Synth Defaults</h2>
        <p>What the below synth settings default to when loading a blank Scale Workshop instance (overriden when loading custom scale links)</p>
        <div class="control-group">
          <h3>Generator</h3>
          <div class="control radio-group">
            <label>Synth type</label>
            <span>
              <input type="radio" id="default-type-oscillator" value="oscillator" v-model="state.defaultSynthType" />
              <label for="default-type-oscillator">Oscillator</label>
            </span>
            <span>
              <input type="radio" id="default-type-unison" value="unison" v-model="state.defaultSynthType" />
              <label for="default-type-unison">Unison</label>
            </span>
            <span>
              <input type="radio" id="default-type-aperiodic" value="aperiodic" v-model="state.defaultSynthType" />
              <label for="default-type-aperiodic">Aperiodic</label>
            </span>
          </div>
          <template v-if="state.defaultSynthType === 'unison'">
            <div class="control">
              <label for="default-stack-size">Unison stack size</label>
              <input id="default-stack-size" min="2" max="9" type="number" v-model="state.defaultUnisonStackSize" />
            </div>
            <label for="default-unison-spread">Unison spread</label>
            <input id="default-unison-spread" class="control" type="range" min="0.01" max="100" step="any" v-model="state.defaultUnisonSpread" />
          </template>
          <div class="control">
            <label for="waveform">Waveform</label>
            <select v-if="state.defaultSynthType === 'aperiodic'" class="control" v-model="state.defaultAperiodicWaveform" >
              <option v-for="waveform of APERIODIC_WAVEFORMS" :value="waveform" :key="waveform">
                {{ waveform }}
              </option>
            </select>
            <select v-else id="waveform" class="control" v-model="state.defaultWaveform">
              <option v-for="waveform of WAVEFORMS" :value="waveform" :key="waveform">
                {{ waveform }}
              </option>
            </select>
          </div>

          <h3>Envelope Preset</h3>
          <div class="control radio-group">
            <span>
              <input type="radio" id="default-organ" value="organ" v-model="state.defaultEnvelope" />
              <label for="default-organ">Organ</label>
            </span>
            <span>
              <input type="radio" id="default-pad" value="pad" v-model="state.defaultEnvelope" />
              <label for="default-pad">Pad</label>
            </span>
            <span>
              <input type="radio" id="default-short" value="short" v-model="state.defaultEnvelope" />
              <label for="default-short">Percussive (Short)</label>
            </span>
            <span>
              <input type="radio" id="default-medium" value="medium" v-model="state.defaultEnvelope" />
              <label for="default-medium">Percussive (Medium)</label>
            </span>
            <span>
              <input type="radio" id="default-long" value="long" v-model="state.defaultEnvelope" />
              <label for="default-long">Percussive (Long)</label>
            </span>
          </div>

          <h3>Delay Preset</h3>
          <div class="control radio-group">
            <span>
              <input type="radio" id="default-off" value="off" v-model="state.defaultDelay" />
              <label for="default-off">Off</label>
            </span>
            <span>
              <input type="radio" id="default-mono" value="mono" v-model="state.defaultDelay" />
              <label for="default-mono">Basic (Mono)</label>
            </span>
            <span>
              <input type="radio" id="default-stereo" value="stereo" v-model="state.defaultDelay" />
              <label for="default-stereo">Basic (Stereo)</label>
            </span>
            <span>
              <input type="radio" id="default-intense" value="intense" v-model="state.defaultDelay" />
              <label for="default-intense">Intense</label>
            </span>
            <span>
              <input type="radio" id="default-elastic" value="elastic" v-model="state.defaultDelay" />
              <label for="default-elastic">Elastic</label>
            </span>
            <span>
              <input type="radio" id="default-ambient" value="ambient" v-model="state.defaultDelay" />
              <label for="default-ambient">Ambient</label>
            </span>
          </div>

          <h3>Keyboard Mode</h3>
          <div class="control radio-group">
            <span>
              <input type="radio" id="default-off" value="off" v-model="state.defaultDelay" />
              <label for="default-off">Off</label>
            </span>
            <span>
              <input type="radio" id="default-mono" value="mono" v-model="state.defaultDelay" />
              <label for="default-mono">Basic (Mono)</label>
            </span>
          </div>

          <h3>Isomorphic Key Mapping</h3>
          <div class="control-group" style="flex-direction: row; align-items: stretch; flex-wrap: nowrap">
            <div class="control" style="width: 50%">
              <label for="default-vertical">Vertical</label>
              <input type="number" id="default-vertical" v-model="state.defaultIsomorphicVertical" />
            </div>
            <div class="control" style="width: 50%">
              <label for="default-horizontal">Horizontal</label>
              <input type="number" id="default-horizontal" v-model="state.defaultIsomorphicHorizontal" />
            </div>
          </div>

        </div>
      </div>
      <div class="column">
        <h2>Appearance</h2>
        <div class="control-group">
          <h3>Color Scheme</h3>
          <div class="control radio-group">
            <span>
              <input type="radio" id="scheme-light" value="light" v-model="state.colorScheme" />
              <label for="scheme-light">Light</label>
            </span>
            <span>
              <input type="radio" id="scheme-dark" value="dark" v-model="state.colorScheme" />
              <label for="scheme-dark">Dark</label>
            </span>
          </div>
          <h3>Accidentals</h3>
          <div class="control radio-group">
            <span>
              <input
                type="radio"
                id="accidentals-double"
                value="double"
                v-model="scale.accidentalPreference"
              />
              <label for="accidentals-double">Double 𝄫/𝄪</label>
            </span>
            <span>
              <input
                type="radio"
                id="accidentals-single"
                value="single"
                v-model="scale.accidentalPreference"
              />
              <label for="accidentals-single">Single ♭♭/♯♯</label>
            </span>
            <span>
              <input
                type="radio"
                id="accidentals-ascii"
                value="ASCII"
                v-model="scale.accidentalPreference"
              />
              <label for="accidentals-single">ASCII bb/##</label>
            </span>
          </div>
        </div>
        <h2>Precision</h2>
        <div class="control-group">
          <div class="control">
            <label for="cents">Cents digits after decimal point</label>
            <input
              id="cents"
              type="number"
              class="control"
              min="0"
              v-model="scale.centsFractionDigits"
            />
          </div>
          <div class="control">
            <label for="decimal">Decimal digits after decimal comma</label>
            <input
              id="decimal"
              type="number"
              class="control"
              min="0"
              v-model="scale.decimalFractionDigits"
            />
          </div>
        </div>
        <h2>Analytics</h2>
        <div class="control-group">
          <div class="control checkbox-container">
            <input id="virtual-qwerty" type="checkbox" v-model="state.shareStatistics" />
            <label for="virtual-qwerty" class="right-of-checkbox"
              >Share statistics to help improve the application</label
            >
          </div>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
div.columns-container {
  height: 100%;
  overflow-y: auto;
}
div.column {
  overflow-x: hidden;
  padding: 1rem;
}

@media screen and (min-width: 860px) {
  div.columns-container {
    background-color: var(--color-border);
    column-count: 3;
    column-gap: 1px;
    height: 100%;
  }
  div.column {
    height: 100%;
    overflow-y: auto;
    background-color: var(--color-background);
  }
}
</style>
