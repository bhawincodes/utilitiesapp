
import { configureStore } from '@reduxjs/toolkit';

import exampleReducer from './slices/exampleSlice';
import userReducer from './slices/userSlice';

export const store = configureStore({
  reducer: {
    example: exampleReducer,
    user: userReducer,
  },
});
