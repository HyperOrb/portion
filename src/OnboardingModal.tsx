import { useState, useMemo } from 'react';
import {
  calculateBmr,
  calculateTdee,
  calculateNutritionTargets,
  type ActivityLevel,
  type FitnessGoal,
  type Gender,
  type Nutrients,
  type UserProfile,
} from './domain';
import { Icon, Modal, number } from './ui';

export default function OnboardingModal({
  initialProfile,
  onSave,
  onClose,
}: {
  initialProfile?: UserProfile | null;
  onSave: (profile: UserProfile, targets: Nutrients) => Promise<boolean>;
  onClose: () => void;
}) {
  const [gender, setGender] = useState<Gender>(initialProfile?.gender ?? 'male');
  const [age, setAge] = useState<number>(initialProfile?.age ?? 25);
  const [heightCm, setHeightCm] = useState<number>(initialProfile?.heightCm ?? 170);
  const [weightKg, setWeightKg] = useState<number>(initialProfile?.weightKg ?? 65);
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(
    initialProfile?.activityLevel ?? 'moderate'
  );
  const [goal, setGoal] = useState<FitnessGoal>(initialProfile?.goal ?? 'fat_loss');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const currentProfile: UserProfile = useMemo(
    () => ({
      gender,
      age: Math.max(10, Math.min(120, age || 25)),
      heightCm: Math.max(50, Math.min(250, heightCm || 170)),
      weightKg: Math.max(20, Math.min(350, weightKg || 65)),
      activityLevel,
      goal,
    }),
    [gender, age, heightCm, weightKg, activityLevel, goal]
  );

  const bmr = useMemo(() => calculateBmr(currentProfile), [currentProfile]);
  const tdee = useMemo(() => calculateTdee(currentProfile), [currentProfile]);
  const targets = useMemo(() => calculateNutritionTargets(currentProfile), [currentProfile]);

  const proteinRatio = goal === 'fat_loss' ? '2.0 g/kg' : goal === 'muscle_gain' ? '1.8 g/kg' : '1.6 g/kg';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!age || age < 10 || age > 120) {
      setError('Masukkan usia yang valid (10 - 120 tahun).');
      return;
    }
    if (!heightCm || heightCm < 50 || heightCm > 250) {
      setError('Masukkan tinggi badan yang valid (50 - 250 cm).');
      return;
    }
    if (!weightKg || weightKg < 20 || weightKg > 350) {
      setError('Masukkan berat badan yang valid (20 - 350 kg).');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const ok = await onSave(currentProfile, targets);
      if (ok) {
        onClose();
      } else {
        setError('Gagal menyimpan profil dan target. Silakan coba lagi.');
      }
    } catch (err) {
      setError((err as Error).message || 'Terjadi kesalahan saat menyimpan.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Profil Tubuh & Target Harian" onClose={onClose}>
      <p className="muted small">
        Bantu kami menghitung kebutuhan kalori dan makronutrisi harianmu secara ilmiah menggunakan rumus Mifflin-St Jeor.
      </p>

      <form onSubmit={handleSubmit} className="onboarding-form">
        {/* Gender Selection */}
        <div className="onboarding-field">
          <span className="summary-label">Jenis Kelamin</span>
          <div className="segmented-group" role="radiogroup" aria-label="Jenis kelamin">
            <button
              type="button"
              className={`segmented-button ${gender === 'male' ? 'active' : ''}`}
              onClick={() => setGender('male')}
              role="radio"
              aria-checked={gender === 'male'}
            >
              Cowo (Laki-laki)
            </button>
            <button
              type="button"
              className={`segmented-button ${gender === 'female' ? 'active' : ''}`}
              onClick={() => setGender('female')}
              role="radio"
              aria-checked={gender === 'female'}
            >
              Cewek (Perempuan)
            </button>
          </div>
        </div>

        {/* Physical Stats Grid */}
        <div className="form-grid">
          <label>
            Usia (tahun)
            <input
              type="number"
              inputMode="numeric"
              min="10"
              max="120"
              value={age || ''}
              onChange={(e) => setAge(Number(e.target.value))}
              placeholder="e.g. 24"
              required
            />
          </label>
          <label>
            Tinggi Badan (cm)
            <input
              type="number"
              inputMode="decimal"
              min="50"
              max="250"
              step="any"
              value={heightCm || ''}
              onChange={(e) => setHeightCm(Number(e.target.value))}
              placeholder="e.g. 170"
              required
            />
          </label>
        </div>

        <label>
          Berat Badan Sekarang (kg)
          <input
            type="number"
            inputMode="decimal"
            min="20"
            max="350"
            step="0.1"
            value={weightKg || ''}
            onChange={(e) => setWeightKg(Number(e.target.value))}
            placeholder="e.g. 65"
            required
          />
        </label>

        {/* Activity Frequency */}
        <label>
          Frekuensi Olahraga / Aktivitas Fisik
          <select
            value={activityLevel}
            onChange={(e) => setActivityLevel(e.target.value as ActivityLevel)}
          >
            <option value="sedentary">Jarang / tidak pernah olahraga (Aktivitas santai / duduk)</option>
            <option value="light">Ringan (Olahraga 1 - 2x seminggu)</option>
            <option value="moderate">Sedang (Olahraga 3 - 5x seminggu)</option>
            <option value="active">Rutin / Berat (Olahraga 6 - 7x seminggu)</option>
          </select>
        </label>

        {/* Fitness Goal */}
        <div className="onboarding-field">
          <span className="summary-label">Tujuan Utama (Goal)</span>
          <div className="goal-options">
            <button
              type="button"
              className={`goal-card ${goal === 'fat_loss' ? 'active' : ''}`}
              onClick={() => setGoal('fat_loss')}
            >
              <div className="goal-header">
                <strong>🔥 Nurunin Lemak</strong>
                <span className="badge">Defisit ~450 kcal</span>
              </div>
              <p className="small muted">Kalori defisit sehat dengan target protein tinggi (2.0 g/kg) agar otot terjaga.</p>
            </button>

            <button
              type="button"
              className={`goal-card ${goal === 'maintain' ? 'active' : ''}`}
              onClick={() => setGoal('maintain')}
            >
              <div className="goal-header">
                <strong>⚖️ Jaga Berat Badan</strong>
                <span className="badge subtle">Maintenance</span>
              </div>
              <p className="small muted">Kalori stabil sesuai kebutuhan harian dengan nutrisi seimbang (1.6 g/kg protein).</p>
            </button>

            <button
              type="button"
              className={`goal-card ${goal === 'muscle_gain' ? 'active' : ''}`}
              onClick={() => setGoal('muscle_gain')}
            >
              <div className="goal-header">
                <strong>💪 Bikin Otot</strong>
                <span className="badge">Surplus ~300 kcal</span>
              </div>
              <p className="small muted">Surplus kalori bersih untuk pembentukan massa otot optimal tanpa kelebihan lemak.</p>
            </button>
          </div>
        </div>

        {/* Live Calculation Preview */}
        <div className="calc-preview-card">
          <div className="calc-header">
            <div>
              <span className="eyebrow">Rekomendasi Target Harian</span>
              <h3 className="calc-calories">{number(targets.calories)} <span>kcal / hari</span></h3>
            </div>
            <div className="calc-stats">
              <span className="small muted">BMR: <b>{number(bmr)}</b> kcal</span>
              <span className="small muted">TDEE: <b>{number(tdee)}</b> kcal</span>
            </div>
          </div>

          <div className="macro-preview-grid">
            <div className="macro-preview-item">
              <span className="summary-label"><i className="dot protein" />Protein</span>
              <strong>{number(targets.protein)} g</strong>
              <small className="muted">{proteinRatio}</small>
            </div>
            <div className="macro-preview-item">
              <span className="summary-label"><i className="dot carbs" />Karbohidrat</span>
              <strong>{number(targets.carbs)} g</strong>
              <small className="muted">Energi harian</small>
            </div>
            <div className="macro-preview-item">
              <span className="summary-label"><i className="dot fat" />Lemak</span>
              <strong>{number(targets.fat)} g</strong>
              <small className="muted">Hormon sehat</small>
            </div>
          </div>
        </div>

        {error && <p role="alert" className="error-message">{error}</p>}

        <div className="onboarding-actions">
          <button
            type="submit"
            className="button primary full"
            disabled={saving}
          >
            <Icon name="check" size={16} />
            {saving ? 'Menyimpan target…' : 'Terapkan & Simpan Target'}
          </button>
          <button
            type="button"
            className="text-button full center"
            onClick={onClose}
          >
            Nanti Saja
          </button>
        </div>
      </form>
    </Modal>
  );
}
