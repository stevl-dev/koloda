// WHY: the shared lesson reducer calls `structuredClone`, which TypeScript declares only in the DOM lib.
// On the device, Expo's runtime installs it (`expo/src/winter/runtime.native.ts`), so only the type is missing.
declare function structuredClone<T>(value: T): T;
