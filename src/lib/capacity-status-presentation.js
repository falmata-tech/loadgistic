/** Capacity availability and map overlays share these tokens on web and Expo. */
export const capacityStatusPresentation = Object.freeze({
  EMPTY: Object.freeze({color: '#155eef', soft: '#eaf1ff', text: '#1245ac'}),
  PARTIAL: Object.freeze({color: '#233658', soft: '#e8edf5', text: '#233658'}),
  OFF_DUTY: Object.freeze({color: '#596575', soft: '#f1f3f5', text: '#465465'}),
});

export const capacityMapColors = Object.freeze({
  selection: '#6c809d',
  location: '#526276',
  preferred: '#456da5',
  planned: '#155eef',
  selectedLocation: '#2f70da',
  selectedPreferred: '#647b98',
});
