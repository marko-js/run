import baseAdapter, { type Adapter } from '@marko/run/adapter';
import micromatch from 'micromatch';

export default (): Adapter => {
  return {
    ...baseAdapter(),
    name: 'custom-adapter',
    isEntryTemplate({ template }) {
      return micromatch.isMatch(template, "**/src/pages/**/*.marko");
    }
  }
}