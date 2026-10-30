import { configureStore, createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { api } from '../lib/api';
export const fetchMe = createAsyncThunk('auth/me', async (_, { rejectWithValue }) => {
  try {
    return (await api.post('/auth/session')).data.user;
  } catch {
    return rejectWithValue(null);
  }
});
export const signIn = createAsyncThunk('auth/login', async (values, { rejectWithValue }) => {
  try {
    return (await api.post('/auth/login', values)).data.user;
  } catch (e) {
    return rejectWithValue(
      e.response?.data?.error?.message || 'Unable to sign in. Please try again.',
    );
  }
});
export const signUp = createAsyncThunk('auth/register', async (values, { rejectWithValue }) => {
  try {
    return (await api.post('/auth/register', values)).data.user;
  } catch (e) {
    return rejectWithValue(
      e.response?.data?.error?.details?.[0]?.message ||
        e.response?.data?.error?.message ||
        'Unable to create your account.',
    );
  }
});
export const signOut = createAsyncThunk('auth/logout', async () => {
  await api.post('/auth/logout');
});
const auth = createSlice({
  name: 'auth',
  initialState: { user: null, ready: false, busy: false, error: '' },
  reducers: {
    clearAuthError(state) {
      state.error = '';
    },
    expireSession(state) {
      state.user = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMe.fulfilled, (s, a) => {
        s.user = a.payload;
        s.ready = true;
      })
      .addCase(fetchMe.rejected, (s) => {
        s.ready = true;
        s.user = null;
      });
    for (const thunk of [signIn, signUp]) {
      builder
        .addCase(thunk.pending, (s) => {
          s.busy = true;
          s.error = '';
        })
        .addCase(thunk.fulfilled, (s, a) => {
          s.busy = false;
          s.user = a.payload;
          s.ready = true;
        })
        .addCase(thunk.rejected, (s, a) => {
          s.busy = false;
          s.error = a.payload;
        });
    }
    builder
      .addCase(signOut.fulfilled, (s) => {
        s.user = null;
      })
      .addCase(signOut.rejected, (s) => {
        s.user = null;
      });
  },
});
const ui = createSlice({
  name: 'ui',
  initialState: {
    city: localStorage.getItem('imovies-city') || 'Mumbai',
    notificationCount: 0,
  },
  reducers: {
    setCity(s, a) {
      s.city = a.payload;
      localStorage.setItem('imovies-city', a.payload);
    },
    setNotificationCount(s, a) {
      s.notificationCount = a.payload;
    },
  },
});
export const { clearAuthError, expireSession } = auth.actions;
export const { setCity, setNotificationCount } = ui.actions;
export const store = configureStore({
  reducer: { auth: auth.reducer, ui: ui.reducer },
});
