import { createContext, useContext } from 'react';

import { defaultPreferences, type PreferenceState } from './persistence';

export const PreferenceContext = createContext<PreferenceState>(defaultPreferences());

export const usePreferences = (): PreferenceState => useContext(PreferenceContext);
