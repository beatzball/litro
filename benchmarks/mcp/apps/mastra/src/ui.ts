import { App } from '@modelcontextprotocol/ext-apps';

const app = new App({ name: 'Weather', version: '1.0.0' }, {});
const weather = document.querySelector<HTMLParagraphElement>('#weather')!;
app.ontoolresult = (result) => {
  const data = result.structuredContent as
    | { city?: unknown; tempC?: unknown; summary?: unknown }
    | undefined;
  if (
    data &&
    typeof data.city === 'string' &&
    typeof data.tempC === 'number' &&
    typeof data.summary === 'string'
  ) {
    weather.textContent = `${data.city}: ${data.tempC}°C, ${data.summary}`;
  }
};
app.connect().catch(() => {
  weather.textContent = 'Could not connect to the app host.';
});
