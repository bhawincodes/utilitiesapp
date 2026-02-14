import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

export const postUserProfile = createAsyncThunk(
  'user/postUserProfile',
  async (profile, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('http://localhost:8000/user', profile, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

const initialState = {
  user: null,
  status: 'idle',
  error: null,
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(postUserProfile.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(postUserProfile.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.user = action.payload;
      })
      .addCase(postUserProfile.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      });
  },
});

export default userSlice.reducer;
