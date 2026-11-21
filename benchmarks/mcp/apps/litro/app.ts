import { html } from 'lit';
import { defineMcpApp } from '@beatzball/litro-agent/mcp-app';

export default defineMcpApp({
  uri: 'ui://bench-weather/card',
  title: 'Weather',
  shell: html`<weather-view><h1>Weather</h1><p id="reading">Waiting for weather…</p></weather-view>`,
  styles: 'body { font: 16px system-ui; margin: 16px; }',
  apply: `function (el, data) {
    el.querySelector('#reading').textContent = data.city + ': ' + data.tempC + '°C, ' + data.summary;
  }`,
});
