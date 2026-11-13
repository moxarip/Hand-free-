export interface InputState {
  moveX: number; // -1..1 (right/left relative to camera yaw)
  moveY: number; // -1..1 (forward/back relative to camera yaw)
  camYaw: number;
  camPitch: number;
  jumpPressed: boolean;
  jumpJustPressed: boolean;
  dashJustPressed: boolean;
  grappleJustPressed: boolean;
  resetToCheckpointRequested: boolean;
  restartFromZeroRequested: boolean;
}

export const inputState: InputState = {
  moveX: 0,
  moveY: 0,
  camYaw: 0,
  camPitch: 0.34,
  jumpPressed: false,
  jumpJustPressed: false,
  dashJustPressed: false,
  grappleJustPressed: false,
  resetToCheckpointRequested: false,
  restartFromZeroRequested: false,
};
