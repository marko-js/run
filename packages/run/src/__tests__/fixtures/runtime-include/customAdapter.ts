import baseAdapter, { type Adapter } from '@marko/run/adapter';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const customRuntime = path.join(__dirname, 'src', 'customRuntime');

export default (): Adapter => {
  return {
    ...baseAdapter(),
    name: 'custom-adapter',
    runtimeInclude() {
      return customRuntime;
    }
  }
}