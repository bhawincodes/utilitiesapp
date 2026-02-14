import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  value: 0,
};

const exampleSlice = createSlice({
  name: 'example',
  initialState,
  reducers: {
    increment: (state) => { state.value += 1; },
    decrement: (state) => { state.value -= 1; },
    reset: (state) => { state.value = 0; },
  },
});

export const { increment, decrement, reset } = exampleSlice.actions;
export default exampleSlice.reducer;
