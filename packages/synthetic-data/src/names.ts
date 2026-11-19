// Common given and family names, used only to make synthetic data realistic.
// Combinations are random; any resemblance to a real person is coincidental.
export const GIVEN_NAMES = [
  { ar: 'محمد', fr: 'Mohamed', g: 'M' }, { ar: 'أحمد', fr: 'Ahmed', g: 'M' }, { ar: 'يوسف', fr: 'Youssef', g: 'M' },
  { ar: 'سامي', fr: 'Sami', g: 'M' }, { ar: 'كريم', fr: 'Karim', g: 'M' }, { ar: 'مهدي', fr: 'Mehdi', g: 'M' },
  { ar: 'هشام', fr: 'Hichem', g: 'M' }, { ar: 'وليد', fr: 'Walid', g: 'M' }, { ar: 'أمين', fr: 'Amine', g: 'M' },
  { ar: 'فاطمة', fr: 'Fatma', g: 'F' }, { ar: 'سارة', fr: 'Sarra', g: 'F' }, { ar: 'إيناس', fr: 'Ines', g: 'F' },
  { ar: 'سناء', fr: 'Sana', g: 'F' }, { ar: 'ريم', fr: 'Rim', g: 'F' }, { ar: 'أمل', fr: 'Amel', g: 'F' },
  { ar: 'ليلى', fr: 'Leila', g: 'F' }, { ar: 'مريم', fr: 'Meriem', g: 'F' }, { ar: 'نادية', fr: 'Nadia', g: 'F' },
] as const;

export const FAMILY_NAMES = [
  { ar: 'بن علي', fr: 'Ben Ali' }, { ar: 'الطرابلسي', fr: 'Trabelsi' }, { ar: 'الغربي', fr: 'Gharbi' },
  { ar: 'الحمامي', fr: 'Hammami' }, { ar: 'الجلاصي', fr: 'Jelassi' }, { ar: 'المزوغي', fr: 'Mezoughi' },
  { ar: 'بن صالح', fr: 'Ben Salah' }, { ar: 'الشريف', fr: 'Cherif' }, { ar: 'العياري', fr: 'Ayari' },
  { ar: 'الدريدي', fr: 'Dridi' }, { ar: 'السعيدي', fr: 'Saidi' }, { ar: 'المبروك', fr: 'Mabrouk' },
] as const;

export const BRANCH_CITIES = ['Tunis Centre', 'Tunis Lac', 'Ariana', 'Sfax Centre', 'Sousse', 'Monastir', 'Bizerte', 'Gabès', 'Kairouan', 'Nabeul'] as const;
