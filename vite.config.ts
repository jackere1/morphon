import {defineConfig} from 'vite';
import motionCanvas from '@revideo/vite-plugin';

export default defineConfig({
  plugins: [
    // @ts-ignore - handle CJS/ESM interop
    ...(typeof motionCanvas === 'function'
      ? motionCanvas({project: ['./src/revideo/project.ts']})
      : (motionCanvas as any).default({project: ['./src/revideo/project.ts']})),
  ],
});
