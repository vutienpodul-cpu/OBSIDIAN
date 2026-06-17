/**
 * Skeleton click sequences for common AI tools.
 * User fills Tool URL and Pick Click for selectors not in skeleton.
 */
export const WEB_TASK_PRESETS = {
  flow_ai_image: {
    label: 'Flow AI — Image Gen',
    url: '',
    steps: [
      { type: 'type', selector: '', label: 'Paste prompt', value: '', delay: 300 },
      { type: 'click', selector: '', label: 'Generate', value: '', delay: 500 },
      { type: 'wait', selector: '', label: 'Wait for result', value: '3000', delay: 3000 },
    ],
    grabFrom: '',
    waitFor: '',
    timeout: 180,
  },
  flow_ai_video: {
    label: 'Flow AI — Video Gen',
    url: '',
    steps: [
      { type: 'type', selector: '', label: 'Paste motion prompt', value: '', delay: 300 },
      { type: 'click', selector: '', label: 'Generate video', value: '', delay: 500 },
      { type: 'wait', selector: '', label: 'Wait for render', value: '8000', delay: 8000 },
    ],
    grabFrom: '',
    waitFor: '',
    timeout: 300,
  },
  generic_form: {
    label: 'Generic — Form submit',
    url: '',
    steps: [
      { type: 'type', selector: '', label: 'Input field', value: '', delay: 300 },
      { type: 'click', selector: '', label: 'Submit', value: '', delay: 500 },
    ],
    grabFrom: '',
    waitFor: '',
    timeout: 120,
  },
};
