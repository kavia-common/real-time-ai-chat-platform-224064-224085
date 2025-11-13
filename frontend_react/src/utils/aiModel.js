import * as tf from '@tensorflow/tfjs';

/**
 * Mini client-side emotion classifier using TensorFlow.js.
 * - This is a lightweight demo model trained in-browser with tiny synthetic data.
 * - No secrets are used. All runs locally in the browser.
 *
 * README note for future upgrade:
 * For production-grade accuracy and latency control, consider moving this to a server-side model
 * (Python/PyTorch/TensorFlow) with API endpoints configured via environment variables
 * (e.g., REACT_APP_API_BASE). Keep all secrets server-side, add authentication, and return only
 * anonymized outputs to the client. You can periodically retrain server-side and version models.
 */

// Simple emotions set kept small for demo
const EMOTIONS = ['neutral', 'happy', 'sad', 'angry'];

// Cache model in memory
let modelPromise = null;

/**
 * Convert a text into simple numeric features.
 * This is a very naive featurizer for demonstration:
 * - length normalized
 * - exclamation density
 * - sad/happy keyword counts
 * - uppercase ratio
 */
function featurize(text) {
  const t = (text || '').trim();
  const len = t.length;
  const normLen = Math.min(len, 300) / 300;

  const exclamations = (t.match(/!/g) || []).length;
  const exclamationDensity = Math.min(exclamations / Math.max(1, len / 10), 1);

  const happyWords = (t.match(/\b(happy|great|love|awesome|good|thanks|thank you|yay)\b/gi) || []).length;
  const sadWords = (t.match(/\b(sad|bad|upset|tired|unhappy|depressed|cry)\b/gi) || []).length;
  const angryWords = (t.match(/\b(angry|mad|furious|annoyed|irritated)\b/gi) || []).length;

  const upperChars = (t.match(/[A-Z]/g) || []).length;
  const upperRatio = len > 0 ? Math.min(upperChars / len, 1) : 0;

  // 6 simple features
  return [normLen, exclamationDensity, happyWords / 5, sadWords / 5, angryWords / 5, upperRatio];
}

/**
 * Create a tiny feedforward model suitable for browser demo.
 */
function createModel(inputSize, outputSize) {
  const m = tf.sequential();
  m.add(tf.layers.dense({ units: 8, inputShape: [inputSize], activation: 'relu', kernelInitializer: 'heNormal' }));
  m.add(tf.layers.dense({ units: 8, activation: 'relu', kernelInitializer: 'heNormal' }));
  m.add(tf.layers.dense({ units: outputSize, activation: 'softmax' }));
  m.compile({ optimizer: tf.train.adam(0.01), loss: 'categoricalCrossentropy', metrics: ['accuracy'] });
  return m;
}

/**
 * Train the model quickly on tiny synthetic dataset derived from heuristic labels.
 * This is just to make the demo deterministic and fast.
 */
async function getOrTrainModel() {
  if (modelPromise) return modelPromise;

  modelPromise = (async () => {
    const inputSize = 6;
    const outputSize = EMOTIONS.length;
    const m = createModel(inputSize, outputSize);

    // Tiny synthetic samples based on keywords/punctuation signals
    const samples = [
      { x: featurize('I am happy! This is awesome!'), y: 'happy' },
      { x: featurize('Thank you so much, I love it'), y: 'happy' },
      { x: featurize('I feel sad and tired today'), y: 'sad' },
      { x: featurize('This makes me unhappy'), y: 'sad' },
      { x: featurize('I am so angry right now!!!'), y: 'angry' },
      { x: featurize('This is really annoying and irritating'), y: 'angry' },
      { x: featurize('Just an ordinary message.'), y: 'neutral' },
      { x: featurize('Okay.'), y: 'neutral' },
    ];

    const xs = tf.tensor2d(samples.map(s => s.x));
    const ys = tf.tensor2d(samples.map(s => {
      const idx = EMOTIONS.indexOf(s.y);
      return EMOTIONS.map((_, i) => (i === idx ? 1 : 0));
    }));

    // Quick training; keep epochs tiny for immediate UX
    await m.fit(xs, ys, { epochs: 25, batchSize: 4, shuffle: true, verbose: 0 });

    xs.dispose();
    ys.dispose();

    return m;
  })();

  return modelPromise;
}

/**
 * PUBLIC_INTERFACE
 * Predict an emotion from user text.
 * Returns { label: 'happy'|'sad'|'angry'|'neutral', scores: Record<string, number> }
 */
export async function predictEmotion(text) {
  const m = await getOrTrainModel();
  const feat = featurize(text);
  const input = tf.tensor2d([feat]);
  const pred = m.predict(input);
  const data = await pred.data();

  input.dispose();
  if (pred.dispose) pred.dispose();

  const scores = {};
  let maxIdx = 0;
  let maxVal = data[0];
  for (let i = 0; i < EMOTIONS.length; i++) {
    scores[EMOTIONS[i]] = data[i];
    if (data[i] > maxVal) {
      maxVal = data[i];
      maxIdx = i;
    }
  }
  return { label: EMOTIONS[maxIdx], scores };
}

/**
 * PUBLIC_INTERFACE
 * Adjust a base assistant reply to match desired tone inferred from emotion.
 * This is a simple client-side phrasing prepender/append logic for demo.
 */
export function toneAdjust(reply, emotion) {
  const r = (reply || '').trim();
  if (!r) return r;

  if (emotion === 'happy') {
    return `Great news! 😊 ${r}`;
  }
  if (emotion === 'sad') {
    return `I’m here for you. ${r} If there’s anything else you’d like to share, I’ll listen.`;
  }
  if (emotion === 'angry') {
    return `I understand your frustration. ${r} Let’s address this step by step.`;
  }
  // neutral
  return r;
}
