/**
 * Tutor avatar models (VRoid Hub / VRoid Studio, textures shrunk by tools/avatar/optimize-vrm.mjs). Each has its own
 * motion set, fitted to its body by tools/avatar/convert-mixamo.mjs --vrm=…; see docs/TUTOR_AVATAR.md.
 */
export type AvatarModel = { id: string; label: string; url: string; motions: string; credit: string };

const model = (id: string, label: string, credit: string): AvatarModel =>
  ({ id, label, url: `/models/avatar/tutor-${id}.vrm`, motions: `/models/avatar/anim/${id}/`, credit });

export const AVATAR_MODELS: AvatarModel[] = [
  model('a', 'Сэмпл A', 'AvatarSample_A (VRoid Project, образец VRoid Studio).'),
  model('kiyori', 'Кийори (костюм)', '遠山きより / 赤縁メガネ — автор 歩留マリ (VRoid Hub; указание автора не требуется).'),
  model('mikami', 'Миками (рубашка)', '三上教子 — автор 八峰アドミン (VRoid Hub; указание автора обязательно).'),
  model('male', 'Кадзи', '加持慎也 青年期ver — автор 八峰アドミン (VRoid Hub; указание автора обязательно).'),
  model('glasses', 'Собеседник в очках', 'Модель VRoid Hub: указание автора не требуется.'),
].filter(avatar => avatar.id !== 'kiyori' || process.env.NEXT_PUBLIC_DISABLE_KIYORI !== '1');
