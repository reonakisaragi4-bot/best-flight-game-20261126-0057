// Keyboard and mouse, read fresh every frame. Keys are held in a Set; the
// world reads named actions off the returned object, never raw key codes.
// Mouse steering: moving the pointer away from the centre of the screen
// banks and pitches the plane toward it, like a virtual stick.
const KEY_ACTIONS = {
  KeyW: 'throttleUp', ShiftLeft: 'throttleUp', ShiftRight: 'throttleUp',
  KeyS: 'throttleDown', ControlLeft: 'throttleDown',
  ArrowLeft: 'rollLeft', KeyA: 'rollLeft',
  ArrowRight: 'rollRight', KeyD: 'rollRight',
  ArrowUp: 'pitchUp', KeyI: 'pitchUp',
  ArrowDown: 'pitchDown', KeyK: 'pitchDown',
};

function createInput(canvas) {
  const held = new Set();
  const input = {
    throttleUp: false, throttleDown: false,
    rollLeft: false, rollRight: false,
    pitchUp: false, pitchDown: false,
    mouseX: 0, mouseY: 0, mouseActive: false,
    pressed: {}, // one-shot actions, consumed by the world each frame
  };

  function refresh() {
    for (const key of Object.keys(KEY_ACTIONS)) {
      input[KEY_ACTIONS[key]] = held.has(key);
    }
  }

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    held.add(event.code);
    refresh();
    if (event.code === 'Enter' || event.code === 'Space') input.pressed.confirm = true;
    if (event.code === 'KeyP' || event.code === 'Escape') input.pressed.pause = true;
    if (event.code === 'KeyR') input.pressed.restart = true;
    if (event.code === 'KeyC') input.pressed.camera = true;
    if (event.code === 'KeyM') input.pressed.mute = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
    refresh();
  });
  window.addEventListener('blur', () => {
    held.clear();
    refresh();
    input.mouseActive = false;
  });

  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    input.mouseY = ((event.clientY - rect.top) / rect.height) * 2 - 1;
    input.mouseActive = true;
  });
  canvas.addEventListener('mouseleave', () => {
    input.mouseActive = false;
    input.mouseX = 0;
    input.mouseY = 0;
  });
  canvas.addEventListener('mousedown', () => {
    input.pressed.confirm = true;
  });

  /** Clear the one-shot actions after the world has read them. */
  input.consume = function consume() {
    input.pressed = {};
  };

  return input;
}
