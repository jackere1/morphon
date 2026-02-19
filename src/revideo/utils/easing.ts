import {
  linear,
  easeInSine, easeOutSine, easeInOutSine,
  easeInQuad, easeOutQuad, easeInOutQuad,
  easeInCubic, easeOutCubic, easeInOutCubic,
  easeInQuart, easeOutQuart, easeInOutQuart,
  easeInExpo, easeOutExpo, easeInOutExpo,
  easeInBack, easeOutBack, easeInOutBack,
  easeInBounce, easeOutBounce, easeInOutBounce,
  easeInElastic, easeOutElastic, easeInOutElastic,
  type TimingFunction,
} from '@revideo/core';

const EASING_MAP: Record<string, TimingFunction> = {
  linear,
  easeInSine, easeOutSine, easeInOutSine,
  easeInQuad, easeOutQuad, easeInOutQuad,
  easeIn: easeInQuad,
  easeOut: easeOutQuad,
  easeInOut: easeInOutQuad,
  easeInCubic, easeOutCubic, easeInOutCubic,
  easeInQuart, easeOutQuart, easeInOutQuart,
  easeInExpo, easeOutExpo, easeInOutExpo,
  easeInBack, easeOutBack, easeInOutBack,
  easeInBounce, easeOutBounce, easeInOutBounce,
  easeInElastic, easeOutElastic, easeInOutElastic,
};

export function resolveEasing(
  name?: string,
  defaultEasing?: string,
): TimingFunction {
  const key = name || defaultEasing || 'linear';
  return EASING_MAP[key] || linear;
}
