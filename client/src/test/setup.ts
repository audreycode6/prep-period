import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// React Testing Library unmounts after each test by itself only when Vitest's
// globals are on, and they're off here
afterEach(cleanup);
