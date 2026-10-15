import { Buffer } from 'buffer';

// TON's browser SDK reads Buffer during module initialization. This must run
// before App and its dependencies are evaluated, not inside tonService.ts.
const browserGlobal = globalThis as typeof globalThis & { Buffer?: typeof Buffer };
if (!browserGlobal.Buffer) browserGlobal.Buffer = Buffer;
