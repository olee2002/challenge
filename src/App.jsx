import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  TEAM_STORAGE_KEY,
  safeReadStorage,
  safeWriteStorage,
  getUserScopedStorageDataKey,
} from './storage.js';
import './App.css';

const TEAM_STATE_ID = 'challenge_team';
const CHALLENGE_START_DATE = new Date(2026, 8, 23);
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const isValidSupabaseUrl = (value) =>
  typeof value === 'string' && value.trim().startsWith('http://') ||
  typeof value === 'string' && value.trim().startsWith('https://');
const supabase =
  isValidSupabaseUrl(supabaseUrl) && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

const generate100Days = () => {
  const days = [];
  const startDate = new Date(2026, 8, 23);
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  for (let i = 1; i <= 100; i += 1) {
    const currentDate = new Date(startDate);
    currentDate.setDate(startDate.getDate() + (i - 1));

    const month = currentDate.getMonth() + 1;
    const date = currentDate.getDate();
    const dayOfWeek = dayNames[currentDate.getDay()];

    days.push({
      dayNum: i,
      month,
      dateStr: `${month}.${date}`,
      dayOfWeek,
      checked: false,
      note: '',
    });
  }

  return days;
};

const getMonthColor = (month) => {
  switch (month) {
    case 9:
      return 'bg-amber-100 border-amber-200 text-amber-900';
    case 10:
      return 'bg-orange-100 border-orange-200 text-orange-900';
    case 11:
      return 'bg-emerald-100 border-emerald-200 text-emerald-900';
    case 12:
      return 'bg-sky-100 border-sky-200 text-sky-900';
    default:
      return 'bg-gray-100 border-gray-200';
  }
};

const createParticipant = (name, index = 0) => ({
  id: `${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}-${index}`,
  name,
  challenge: '',
  days: generate100Days(),
});

const TEAM_NAME_DEFAULTS = ['하니', '올리', '벨라', '나쵸', '운동해'];
const LEGACY_TEAM_NAMES = ['민준', '지수', '하린'];

const createDefaultTeam = () => {
  const participants = TEAM_NAME_DEFAULTS.map((name, index) => createParticipant(name, index));
  return {
    selectedId: participants[0].id,
    participants,
  };
};

const saveTeam = (team) => {
  safeWriteStorage(getUserScopedStorageDataKey(), team);
};

const parseStoredTeam = (rawValue) => {
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!parsed || !Array.isArray(parsed.participants) || parsed.participants.length === 0) {
      return null;
    }

    const hasLegacyNames = parsed.participants.some((participant) =>
      LEGACY_TEAM_NAMES.includes(participant.name),
    );

    if (hasLegacyNames) {
      return null;
    }

    return parsed;
  } catch (error) {
    console.warn('Failed to parse stored team data:', error);
    return null;
  }
};

const getStoredTeam = () => {
  try {
    const userScopedKey = getUserScopedStorageDataKey();
    const saved = safeReadStorage(userScopedKey);
    const parsedUserTeam = parseStoredTeam(saved);

    if (parsedUserTeam) {
      return parsedUserTeam;
    }

    const legacySaved = safeReadStorage(TEAM_STORAGE_KEY);
    const parsedLegacyTeam = parseStoredTeam(legacySaved);

    if (!parsedLegacyTeam) {
      return null;
    }

    safeWriteStorage(userScopedKey, parsedLegacyTeam);
    return parsedLegacyTeam;
  } catch (error) {
    console.warn('Failed to read saved team data:', error);
    return null;
  }
};

const getInitialTeam = () => {
  const savedTeam = getStoredTeam();
  if (savedTeam) {
    return savedTeam;
  }

  const defaults = createDefaultTeam();
  saveTeam(defaults);
  return defaults;
};

const syncTeamToSupabase = async (nextTeam) => {
  if (!supabase) {
    return;
  }

  try {
    const { error } = await supabase
      .from('team_state')
      .upsert(
        {
          id: TEAM_STATE_ID,
          data: nextTeam,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      );

    if (error) {
      throw error;
    }
  } catch (error) {
    console.warn('Supabase sync failed:', error);
  }
};

export default function App() {
  const [team, setTeam] = useState(() => getInitialTeam());
  const [newParticipantName, setNewParticipantName] = useState('');
  const [syncState, setSyncState] = useState(supabase ? 'live sync' : 'local only');
  const tileRefs = useRef([]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const challengeStartDate = new Date(CHALLENGE_START_DATE);
  challengeStartDate.setHours(0, 0, 0, 0);

  const hasChallengeStarted = today >= challengeStartDate;
  const todayDayIndex = hasChallengeStarted
    ? Math.max(
        0,
        Math.min(
          Math.floor((today - challengeStartDate) / (1000 * 60 * 60 * 24)),
          99,
        ),
      )
    : 0;

  useEffect(() => {
    saveTeam(team);

    if (!supabase) {
      return;
    }

    const loadTeam = async () => {
      try {
        const { data, error } = await supabase
          .from('team_state')
          .select('*')
          .eq('id', TEAM_STATE_ID)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          throw error;
        }

        if (data && data.data) {
          const incomingTeam = data.data;
          setTeam(incomingTeam);
          saveTeam(incomingTeam);
          setSyncState('live sync');
          return;
        }

        const storedTeam = getStoredTeam() ?? team;
        setTeam(storedTeam);
        await syncTeamToSupabase(storedTeam);
        saveTeam(storedTeam);
        setSyncState('live sync');
      } catch (error) {
        console.warn('Failed to load shared team:', error);
        setSyncState('local fallback');
      }
    };

    loadTeam();

    const channel = supabase
      .channel('challenge-team-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'team_state' },
        (payload) => {
          const incoming = payload.new?.data ?? payload.new;
          if (incoming && Array.isArray(incoming.participants)) {
            setTeam(incoming);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    saveTeam(team);

    if (!supabase) {
      return;
    }

    const persistTeam = async () => {
      try {
        await syncTeamToSupabase(team);
        setSyncState('live sync');
      } catch (error) {
        console.warn('Failed to save shared team:', error);
        setSyncState('sync failed');
        saveTeam(team);
      }
    };

    persistTeam();
  }, [team]);

  useEffect(() => {
    const targetTile = tileRefs.current[todayDayIndex];
    if (targetTile) {
      targetTile.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }, [todayDayIndex]);

  const selectedParticipant =
    team.participants.find((participant) => participant.id === team.selectedId) ?? team.participants[0];

  const days = selectedParticipant?.days ?? generate100Days();

  const toggleCheck = (index) => {
    setTeam((previous) => {
      const nextParticipants = previous.participants.map((participant) => {
        if (participant.id !== previous.selectedId) {
          return participant;
        }

        const nextDays = [...participant.days];
        nextDays[index] = {
          ...nextDays[index],
          checked: !nextDays[index].checked,
        };

        return {
          ...participant,
          days: nextDays,
        };
      });

      return {
        ...previous,
        participants: nextParticipants,
      };
    });
  };

  const updateNote = (index, value) => {
    setTeam((previous) => {
      const nextParticipants = previous.participants.map((participant) => {
        if (participant.id !== previous.selectedId) {
          return participant;
        }

        const nextDays = [...participant.days];
        nextDays[index] = {
          ...nextDays[index],
          note: value,
        };

        return {
          ...participant,
          days: nextDays,
        };
      });

      return {
        ...previous,
        participants: nextParticipants,
      };
    });
  };

  const updateParticipantChallenge = (participantId, value) => {
    setTeam((previous) => ({
      ...previous,
      participants: previous.participants.map((participant) =>
        participant.id === participantId ? { ...participant, challenge: value } : participant,
      ),
    }));
  };

  const addParticipant = () => {
    const trimmedName = newParticipantName.trim();
    if (!trimmedName) {
      return;
    }

    const newParticipant = createParticipant(trimmedName, team.participants.length + 1);
    setTeam((previous) => ({
      selectedId: newParticipant.id,
      participants: [...previous.participants, newParticipant],
    }));
    setNewParticipantName('');
  };

  const deleteParticipant = (participantId) => {
    setTeam((previous) => {
      if (previous.participants.length <= 1) {
        return previous;
      }

      const remainingParticipants = previous.participants.filter(
        (participant) => participant.id !== participantId,
      );

      const nextSelectedId =
        previous.selectedId === participantId
          ? remainingParticipants[0]?.id ?? previous.selectedId
          : previous.selectedId;

      return {
        ...previous,
        selectedId: nextSelectedId,
        participants: remainingParticipants,
      };
    });
  };

  const totalCheckCount = team.participants.reduce(
    (total, participant) => total + participant.days.filter((day) => day.checked).length,
    0,
  );

  const teamCompletion = Math.round((totalCheckCount / (team.participants.length * 100)) * 100) || 0;

  return (
    <div className="challenge-app">
      <header className="challenge-header">
        <span className="challenge-badge">100</span>
        <h1>100일 챌린지</h1>
        <p>작은 실천이 모여, 내가 바라던 한 해를 완성합니다.</p>
      </header>

      <div className="sync-status">{syncState}</div>

      <section className="challenge-info">
        <div className="info-field">
          <label>챌린지명</label>
          <input type="text" value="100일 챌린지" readOnly />
        </div>
        <div className="info-field">
          <label>기간</label>
          <div className="info-value">2026. 9. 23 - 12. 31</div>
        </div>
        <div className="info-field">
          <label>참가자</label>
          <select
            value={selectedParticipant?.id ?? ''}
            onChange={(event) =>
              setTeam((previous) => ({
                ...previous,
                selectedId: event.target.value,
              }))
            }
          >
            {team.participants.map((participant) => (
              <option key={participant.id} value={participant.id}>
                {participant.name}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="team-overview">
        <div className="team-summary-header">
          <h2>팀 진행률</h2>
          <span>{teamCompletion}%</span>
        </div>
        <div className="team-progress-bar">
          <span style={{ width: `${teamCompletion}%` }} />
        </div>
        <div className="team-members">
          {team.participants.map((participant) => {
            const checkedCount = participant.days.filter((day) => day.checked).length;
            const percent = Math.round((checkedCount / 100) * 100);
            const isSelected = participant.id === selectedParticipant?.id;

            return (
              <div key={participant.id} className={`team-member ${isSelected ? 'selected' : ''}`}>
                <button
                  type="button"
                  className="team-member-button"
                  onClick={() =>
                    setTeam((previous) => ({
                      ...previous,
                      selectedId: participant.id,
                    }))
                  }
                >
                  <div className="team-member-row">
                    <span>{participant.name}</span>
                    <span>{checkedCount}/100</span>
                  </div>
                  <div className="mini-progress">
                    <span style={{ width: `${percent}%` }} />
                  </div>
                </button>
                <button
                  type="button"
                  className="delete-participant-button"
                  onClick={() => deleteParticipant(participant.id)}
                  aria-label={`${participant.name} 삭제`}
                >
                  ×
                </button>
                <input
                  type="text"
                  className="team-member-challenge-input"
                  value={participant.challenge ?? ''}
                  onChange={(event) => updateParticipantChallenge(participant.id, event.target.value)}
                  onClick={(event) => event.stopPropagation()}
                  placeholder="챌린지 항목"
                  aria-label={`${participant.name} 챌린지 항목`}
                />
              </div>
            );
          })}
        </div>
      </section>

      <section className="participant-add">
        <input
          type="text"
          value={newParticipantName}
          onChange={(event) => setNewParticipantName(event.target.value)}
          placeholder="새 참가자 이름"
        />
        <button type="button" onClick={addParticipant}>
          추가
        </button>
      </section>

      <div className="selected-participant-label">현재 참가자: {selectedParticipant?.name}</div>

      <section className="challenge-grid" aria-label="100-day challenge tracker">
        {days.map((item, idx) => {
          const isToday = idx === todayDayIndex;
          const todayBadgeText = hasChallengeStarted ? 'Today' : 'Next';

          return (
            <div
              key={`${selectedParticipant?.id}-${item.dayNum}`}
              ref={(element) => {
                tileRefs.current[idx] = element;
              }}
              className={`challenge-item ${getMonthColor(item.month)} ${item.checked ? 'is-checked' : ''} ${isToday ? 'is-today' : ''}`}
              onClick={() => toggleCheck(idx)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  toggleCheck(idx);
                }
              }}
              role="button"
              tabIndex={0}
              aria-label={`${item.dayNum}일차 ${item.dateStr} ${item.dayOfWeek}`}
            >
              <div className="challenge-main">
                <div className="challenge-top">
                  <span>{item.dayNum}</span>
                  <span className={`check-indicator ${item.checked ? 'checked' : ''}`} />
                </div>
                <div className="challenge-date">{item.dateStr}</div>
                <div className="challenge-weekday">{item.dayOfWeek}</div>
                {isToday && <div className="today-badge">{todayBadgeText}</div>}
              </div>
              <textarea
                value={item.note}
                onChange={(event) => updateNote(idx, event.target.value)}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
                placeholder="운동 내용"
                rows={2}
                aria-label={`${item.dayNum}일차 메모`}
              />
            </div>
          );
        })}
      </section>

      <footer className="challenge-footer">
        오늘의 한 걸음이 100일 뒤의 나를 만듭니다 | DREAM RUNNER CLUB
      </footer>
    </div>
  );
}
