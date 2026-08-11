import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { localDate } from '../lib/date';
import { useToast } from './ToastContext';
import { Modal } from './shared';

type MealSlot = 'MORNING' | 'LUNCH' | 'AFTERNOON' | 'EVENING';

interface NutritionLog {
  id: string;
  meal_slot: MealSlot;
  food_name: string;
  price: number;
  log_date: string;
  created_at: string;
}

const mealSlotInfo = {
  MORNING: { label: 'Sáng', color: '#f59e0b', bg: '#fef3c7' },
  LUNCH: { label: 'Trưa', color: '#10b981', bg: '#d1fae5' },
  AFTERNOON: { label: 'Chiều', color: '#f43f5e', bg: '#ffe4e6' },
  EVENING: { label: 'Tối', color: '#6366f1', bg: '#e0e7ff' },
};

export function NutritionPage() {
  const [currentDate, setCurrentDate] = useState(localDate(new Date()));
  const [logs, setLogs] = useState<NutritionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newItem, setNewItem] = useState({ food_name: '', price: '', meal_slot: 'MORNING' as MealSlot });
  const { showToast } = useToast();

  useEffect(() => {
    fetchLogs();
  }, [currentDate]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase!
        .from('nutrition_logs')
        .select('*')
        .eq('log_date', currentDate)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error fetching logs, using fallback', error);
      const localData = localStorage.getItem(`nutrition_logs_${currentDate}`);
      if (localData) {
        setLogs(JSON.parse(localData));
      } else {
        setLogs([]);
      }
      showToast('Offline mode or fetch failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async () => {
    if (!newItem.food_name.trim() || !newItem.price) {
      showToast('Vui lòng nhập tên món và giá');
      return;
    }

    const priceNum = parseInt(newItem.price.replace(/,/g, ''), 10) || 0;

    const newLog: Partial<NutritionLog> = {
      meal_slot: newItem.meal_slot,
      food_name: newItem.food_name.trim(),
      price: priceNum,
      log_date: currentDate,
    };

    try {
      const { data, error } = await supabase!
        .from('nutrition_logs')
        .insert(newLog)
        .select()
        .single();

      if (error) throw error;
      setLogs(prev => [...prev, data]);
      showToast('Thêm món thành công', 'success');
    } catch (error) {
      console.error('Error saving to supabase, using fallback', error);
      const fallbackLog = { ...newLog, id: Date.now().toString(), created_at: new Date().toISOString() } as NutritionLog;
      const updatedLogs = [...logs, fallbackLog];
      setLogs(updatedLogs);
      localStorage.setItem(`nutrition_logs_${currentDate}`, JSON.stringify(updatedLogs));
      showToast('Đã lưu offline', 'success');
    }

    setNewItem({ food_name: '', price: '', meal_slot: 'MORNING' });
    setIsModalOpen(false);
  };

  const handleDeleteItem = async (id: string) => {
    try {
      const { error } = await supabase!
        .from('nutrition_logs')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      setLogs(prev => prev.filter(log => log.id !== id));
      showToast('Đã xóa món', 'success');
    } catch (error) {
      console.error('Error deleting, using fallback', error);
      const updatedLogs = logs.filter(log => log.id !== id);
      setLogs(updatedLogs);
      localStorage.setItem(`nutrition_logs_${currentDate}`, JSON.stringify(updatedLogs));
      showToast('Đã xóa offline', 'success');
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
  };

  const changeDate = (days: number) => {
    const date = new Date(currentDate);
    date.setDate(date.getDate() + days);
    setCurrentDate(localDate(date));
  };

  const groupedLogs = {
    MORNING: logs.filter(log => log.meal_slot === 'MORNING'),
    LUNCH: logs.filter(log => log.meal_slot === 'LUNCH'),
    AFTERNOON: logs.filter(log => log.meal_slot === 'AFTERNOON'),
    EVENING: logs.filter(log => log.meal_slot === 'EVENING'),
  };

  const grandTotal = logs.reduce((sum, log) => sum + log.price, 0);

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ margin: 0, fontSize: '24px', color: 'var(--primary)', fontWeight: 'bold' }}>Dinh dưỡng</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button onClick={() => changeDate(-1)} style={btnStyle}>&lt;</button>
          <span style={{ fontWeight: '600', minWidth: '100px', textAlign: 'center' }}>{currentDate}</span>
          <button onClick={() => changeDate(1)} style={btnStyle}>&gt;</button>
        </div>
      </div>

      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: 'var(--primary)', color: 'white', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
        <span style={{ fontSize: '18px', fontWeight: '500' }}>Tổng chi phí hôm nay</span>
        <span style={{ fontSize: '24px', fontWeight: 'bold' }}>{formatPrice(grandTotal)}</span>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>Đang tải...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', flex: 1, overflowY: 'auto', paddingBottom: '20px' }}>
          {(Object.keys(mealSlotInfo) as MealSlot[]).map(slot => {
            const slotLogs = groupedLogs[slot];
            const slotTotal = slotLogs.reduce((sum, log) => sum + log.price, 0);
            const info = mealSlotInfo[slot];

            return (
              <div key={slot} style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '16px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px', borderBottom: '1px solid var(--card-border)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: info.color }}></div>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>{info.label}</h3>
                  </div>
                  <span style={{ fontWeight: '600', color: 'var(--primary)' }}>{formatPrice(slotTotal)}</span>
                </div>
                
                <div style={{ padding: '15px 20px', flex: 1, overflowY: 'auto' }}>
                  {slotLogs.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#888', fontStyle: 'italic', padding: '20px 0' }}>Chưa có món nào</div>
                  ) : (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {slotLogs.map(log => (
                        <li key={log.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', backgroundColor: 'var(--bg-main)', borderRadius: '8px' }}>
                          <span style={{ fontWeight: '500' }}>{log.food_name}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <span style={{ color: '#555' }}>{formatPrice(log.price)}</span>
                            <button onClick={() => handleDeleteItem(log.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '5px' }}>✕</button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                
                <div style={{ padding: '15px 20px', borderTop: '1px solid var(--card-border)' }}>
                  <button 
                    onClick={() => { setNewItem(prev => ({ ...prev, meal_slot: slot })); setIsModalOpen(true); }}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px dashed var(--primary)', backgroundColor: 'transparent', color: 'var(--primary)', cursor: 'pointer', fontWeight: '500', transition: 'all 0.2s' }}
                    onMouseOver={e => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.03)'}
                    onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    + Thêm món
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isModalOpen && (
        <Modal onClose={() => setIsModalOpen(false)} title="Thêm món ăn">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div>
              <label style={labelStyle}>Bữa ăn</label>
              <select 
                value={newItem.meal_slot} 
                onChange={e => setNewItem({...newItem, meal_slot: e.target.value as MealSlot})}
                style={inputStyle}
              >
                {Object.entries(mealSlotInfo).map(([key, info]) => (
                  <option key={key} value={key}>{info.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Tên món</label>
              <input 
                type="text" 
                value={newItem.food_name} 
                onChange={e => setNewItem({...newItem, food_name: e.target.value})}
                placeholder="Ví dụ: Phở bò"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Giá (VNĐ)</label>
              <input 
                type="number" 
                value={newItem.price} 
                onChange={e => setNewItem({...newItem, price: e.target.value})}
                placeholder="Ví dụ: 35000"
                style={inputStyle}
              />
            </div>
            <button 
              onClick={handleAddItem}
              style={{ padding: '12px', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' }}
            >
              Lưu món ăn
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

const btnStyle = {
  padding: '6px 12px',
  borderRadius: '6px',
  border: '1px solid var(--card-border)',
  backgroundColor: 'var(--card-bg)',
  cursor: 'pointer',
  fontWeight: 'bold',
  color: 'var(--primary)'
};

const labelStyle = {
  display: 'block',
  marginBottom: '5px',
  fontWeight: '500',
  fontSize: '14px',
  color: '#555'
};

const inputStyle = {
  width: '100%',
  padding: '10px',
  borderRadius: '8px',
  border: '1px solid var(--card-border)',
  backgroundColor: 'var(--bg-main)',
  boxSizing: 'border-box' as const
};
