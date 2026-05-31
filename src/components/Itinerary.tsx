import { useState, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MapPin, UtensilsCrossed, Hotel, Bus, Lock, Unlock, X, Clock, Star, Coins, Pencil, RefreshCw, Check, Wrench, Settings, MapPinned } from 'lucide-react';
import type { DayPlan, ItineraryItem } from '../types';
import './Itinerary.css';

interface Props {
  dailyPlans: DayPlan[];
  highlightDayIndex?: number | null;
  highlightItemIndex?: number | null;
  onItemClick?: (dayIndex: number, itemIndex: number) => void;
  onReorder?: (dayIndex: number, fromIndex: number, toIndex: number) => void;
  onDelete?: (dayIndex: number, itemIndex: number) => void;
  onToggleLock?: (dayIndex: number, itemIndex: number) => void;
  onReplace?: (dayIndex: number, itemIndex: number, newItem: ItineraryItem) => void;
  onFetchCandidates?: (dayIndex: number, itemIndex: number) => Promise<ItineraryItem[]>;
  onConfirmDayEdit?: (dayIndex: number) => Promise<void>;
  onRegenerateDay?: (dayIndex: number) => Promise<void>;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  attraction: <MapPin size={16} />,
  meal: <UtensilsCrossed size={16} />,
  lodging: <Hotel size={16} />,
  transit: <Bus size={14} />,
};

const MEAL_LABELS: Record<string, string> = {
  breakfast: '\u65E9\u9910',
  lunch: '\u5348\u9910',
  dinner: '\u665A\u9910',
};

function formatCost(min: number, max: number) {
  if (min === 0 && max === 0) return '\u514D\u8CBB';
  if (min === max) return `NT$${min}`;
  return `NT$${min}\u2013${max}`;
}

export default function Itinerary({
  dailyPlans, highlightDayIndex, highlightItemIndex,
  onItemClick, onReorder, onDelete, onToggleLock,
  onReplace, onFetchCandidates, onConfirmDayEdit, onRegenerateDay,
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  if (dailyPlans.length === 0) return null;

  return (
    <div className="itinerary">
      {dailyPlans.map((day, dayIdx) => (
        <DayBlock
          key={day.dayNumber}
          day={day}
          dayIdx={dayIdx}
          highlightDayIndex={highlightDayIndex}
          highlightItemIndex={highlightItemIndex}
          onItemClick={onItemClick}
          onReorder={onReorder}
          onDelete={onDelete}
          onToggleLock={onToggleLock}
          onReplace={onReplace}
          onFetchCandidates={onFetchCandidates}
          onConfirmDayEdit={onConfirmDayEdit}
          onRegenerateDay={onRegenerateDay}
          sensors={sensors}
        />
      ))}
    </div>
  );
}

function DayBlock({
  day, dayIdx, highlightDayIndex, highlightItemIndex,
  onItemClick, onReorder, onDelete, onToggleLock,
  onReplace, onFetchCandidates, onConfirmDayEdit, onRegenerateDay, sensors,
}: {
  day: DayPlan;
  dayIdx: number;
  highlightDayIndex?: number | null;
  highlightItemIndex?: number | null;
  onItemClick?: (d: number, i: number) => void;
  onReorder?: (d: number, from: number, to: number) => void;
  onDelete?: (d: number, i: number) => void;
  onToggleLock?: (d: number, i: number) => void;
  onReplace?: (d: number, i: number, newItem: ItineraryItem) => void;
  onFetchCandidates?: (d: number, i: number) => Promise<ItineraryItem[]>;
  onConfirmDayEdit?: (d: number) => Promise<void>;
  onRegenerateDay?: (d: number) => Promise<void>;
  sensors: ReturnType<typeof useSensors>;
}) {
  const isRainy = day.weather.precipProbability > 60;

  const [editing, setEditing] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [regenLoading, setRegenLoading] = useState(false);
  const [replacingIdx, setReplacingIdx] = useState<number | null>(null);
  const [candidates, setCandidates] = useState<ItineraryItem[]>([]);
  const [candidateLoading, setCandidateLoading] = useState(false);

  // In edit mode, only show non-transit items
  const editItems = editing
    ? day.items.filter((it) => it.type !== 'transit')
    : day.items;

  // Build a mapping from editItems index to original items index
  const editToOrigMap: number[] = [];
  if (editing) {
    day.items.forEach((it, i) => {
      if (it.type !== 'transit') editToOrigMap.push(i);
    });
  }

  const getOrigIdx = (editIdx: number) => editing ? editToOrigMap[editIdx] : editIdx;

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromEdit = editItems.findIndex((it) => it.id === active.id);
    const toEdit = editItems.findIndex((it) => it.id === over.id);
    if (fromEdit !== -1 && toEdit !== -1) {
      onReorder?.(dayIdx, getOrigIdx(fromEdit), getOrigIdx(toEdit));
    }
  }, [editItems, dayIdx, onReorder, editing, editToOrigMap]);

  const handleEnterEdit = () => {
    setEditing(true);
    setReplacingIdx(null);
    setCandidates([]);
  };

  const handleConfirmEdit = async () => {
    setConfirmLoading(true);
    setReplacingIdx(null);
    setCandidates([]);
    try {
      await onConfirmDayEdit?.(dayIdx);
    } finally {
      setConfirmLoading(false);
      setEditing(false);
    }
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setReplacingIdx(null);
    setCandidates([]);
  };

  const handleRegenerateDay = async () => {
    setRegenLoading(true);
    setReplacingIdx(null);
    setCandidates([]);
    try {
      await onRegenerateDay?.(dayIdx);
    } finally {
      setRegenLoading(false);
      setEditing(false);
    }
  };

  const handleRequestReplace = async (editIdx: number) => {
    if (replacingIdx === editIdx) {
      setReplacingIdx(null);
      setCandidates([]);
      return;
    }
    setReplacingIdx(editIdx);
    setCandidates([]);
    setCandidateLoading(true);
    try {
      const origIdx = getOrigIdx(editIdx);
      const results = await onFetchCandidates?.(dayIdx, origIdx) ?? [];
      setCandidates(results);
    } catch (err) {
      console.error('Failed to fetch candidates:', err);
      setCandidates([]);
    } finally {
      setCandidateLoading(false);
    }
  };

  const handleSelectCandidate = (candidate: ItineraryItem) => {
    if (replacingIdx === null) return;
    const origIdx = getOrigIdx(replacingIdx);
    onReplace?.(dayIdx, origIdx, candidate);
    setReplacingIdx(null);
    setCandidates([]);
  };

  return (
    <div className={`day-block ${editing ? 'day-block--editing' : ''}`}>
      <div className="day-header">
        <div className="day-title">
          <span className="day-number">Day {day.dayNumber}</span>
          <span className="day-date">{formatDate(day.date)}</span>
        </div>
        <div className="day-header-right">
          <div className="day-weather-badge">
            <span className="badge-emoji">{day.weather.emoji}</span>
            <span className="badge-desc">{day.weather.description}</span>
            <span className="badge-temp">{Math.round(day.weather.maxTemp)}{'\u00B0'} / {Math.round(day.weather.minTemp)}{'\u00B0'}</span>
          </div>
          <div className="day-budget-badge">
            <Coins size={13} style={{ verticalAlign: 'text-bottom', marginRight: 2 }} /> {formatCost(day.dayBudgetMin, day.dayBudgetMax)}
          </div>
        </div>
      </div>

      {day.lodgingArea && (
        <div className="lodging-area-tag"><Hotel size={14} style={{ verticalAlign: 'text-bottom', marginRight: 4 }} /> {'\u4F4F\u5BBF\u5340\u57DF\uFF1A'}{day.lodgingArea}</div>
      )}

      {isRainy && (
        <div className="rain-warning">
          {'\u{1F302}'} {'\u9019\u5929\u964D\u96E8\u6A5F\u7387'} {day.weather.precipProbability}%{'\uFF0C\u5DF2\u512A\u5148\u5B89\u6392\u5BA4\u5167\u666F\u9EDE'}
        </div>
      )}

      {/* Edit mode toolbar */}
      <div className="day-edit-toolbar no-print">
        {!editing ? (
          <button className="edit-day-btn" onClick={handleEnterEdit}>
            <Pencil size={13} style={{ verticalAlign: 'text-bottom', marginRight: 4 }} /> {'\u4FEE\u6539\u884C\u7A0B'}
          </button>
        ) : (
          <div className="edit-mode-bar">
            <span className="edit-mode-label"><Wrench size={13} style={{ verticalAlign: 'text-bottom', marginRight: 4 }} /> {'\u7DE8\u8F2F\u6A21\u5F0F'} {'\u2014'} {'\u62D6\u62C9\u6392\u5E8F\u3001\u522A\u9664\u6216\u9EDE\u64CA\u66FF\u63DB\u9805\u76EE\uFF0C\u5B8C\u6210\u5F8C\u6309\u78BA\u8A8D'}</span>
            <div className="edit-mode-actions">
              <button className="regen-day-btn" onClick={handleRegenerateDay} disabled={confirmLoading || regenLoading}>
                {regenLoading ? <><Settings size={13} className="lucide-spin" /> AI {'\u91CD\u65B0\u7522\u751F\u4E2D\u2026'}</> : <><RefreshCw size={13} style={{ verticalAlign: 'text-bottom', marginRight: 3 }} /> {'\u91CD\u65B0\u7522\u751F\u884C\u7A0B'}</>}
              </button>
              <button className="cancel-edit-btn" onClick={handleCancelEdit} disabled={confirmLoading || regenLoading}>
                {'\u53D6\u6D88'}
              </button>
              <button className="confirm-edit-btn" onClick={handleConfirmEdit} disabled={confirmLoading || regenLoading}>
                {confirmLoading ? <><Settings size={13} className="lucide-spin" /> AI {'\u898F\u5283\u4E2D\u2026'}</> : <><Check size={13} style={{ verticalAlign: 'text-bottom', marginRight: 3 }} /> {'\u78BA\u8A8D\u4FEE\u6539'}</>}
              </button>
            </div>
          </div>
        )}
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={editItems.map((it) => it.id)} strategy={verticalListSortingStrategy}>
          <div className="items-list">
            {editItems.map((item, editIdx) => {
              const origIdx = getOrigIdx(editIdx);
              const isActive = !editing && dayIdx === highlightDayIndex && origIdx === highlightItemIndex;
              const isTransit = item.type === 'transit';
              const isReplacing = editing && replacingIdx === editIdx;

              if (isTransit && !editing) {
                return (
                  <SortableItemCard
                    key={item.id}
                    item={item}
                    isActive={false}
                    editing={false}
                    isReplacing={false}
                    onClick={() => {}}
                    onDelete={() => onDelete?.(dayIdx, origIdx)}
                    onToggleLock={() => {}}

                  />
                );
              }

              return (
                <div key={item.id}>
                  <SortableItemCard
                    item={item}
                    isActive={isActive}
                    editing={editing}
                    isReplacing={isReplacing}
                    onClick={() => {
                      if (editing) {
                        handleRequestReplace(editIdx);
                      } else {
                        onItemClick?.(dayIdx, origIdx);
                      }
                    }}
                    onDelete={() => onDelete?.(dayIdx, origIdx)}
                    onToggleLock={() => onToggleLock?.(dayIdx, origIdx)}
                  />
                  {/* Replacement candidates panel */}
                  {isReplacing && (
                    <div className="candidates-panel">
                      <div className="candidates-header">
                        <RefreshCw size={13} style={{ verticalAlign: 'text-bottom', marginRight: 4 }} /> {'\u9078\u64C7\u66FF\u4EE3\u65B9\u6848'}
                        <button className="candidates-close" onClick={() => { setReplacingIdx(null); setCandidates([]); }}>{'\u2715'}</button>
                      </div>
                      {candidateLoading ? (
                        <div className="candidates-loading">
                          <div className="candidates-spinner" />
                          AI {'\u63A8\u85A6\u4E2D\u2026'}
                        </div>
                      ) : candidates.length === 0 ? (
                        <div className="candidates-empty">{'\u7121\u6CD5\u53D6\u5F97\u66FF\u4EE3\u65B9\u6848'}</div>
                      ) : (
                        <div className="candidates-list">
                          {candidates.map((c) => (
                            <CandidateCard
                              key={c.id}
                              candidate={c}
                              onSelect={() => handleSelectCandidate(c)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function CandidateCard({ candidate, onSelect }: { candidate: ItineraryItem; onSelect: () => void }) {
  return (
    <div className="candidate-card" onClick={onSelect} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onSelect(); }}>
      <div className="candidate-icon">{TYPE_ICONS[candidate.type]}</div>
      <div className="candidate-content">
        <h5 className="candidate-name">{candidate.name}</h5>
        {candidate.address && <div className="candidate-address">{candidate.address}</div>}
        <p className="candidate-desc">{candidate.description}</p>
        <div className="candidate-meta">
          <span>{formatCost(candidate.costMin, candidate.costMax)}</span>
          {candidate.durationMinutes > 0 && <span>{'\u23F1\uFE0F'} {candidate.durationMinutes} {'\u5206\u9418'}</span>}
        </div>
      </div>
      <div className="candidate-select-hint">{'\u9EDE\u64CA\u9078\u64C7'}</div>
    </div>
  );
}

function SortableItemCard({ item, isActive, editing, isReplacing, onClick, onDelete, onToggleLock }: {
  item: ItineraryItem;
  isActive: boolean;
  editing: boolean;
  isReplacing: boolean;
  onClick: () => void;
  onDelete: () => void;
  onToggleLock: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  const isTransit = item.type === 'transit';

  // Transit card: normal mode = static display, never shown in edit mode
  if (isTransit) {
    return (
      <div ref={setNodeRef} style={style} className="item-card item-card--transit">
        <div className="item-icon item-icon--transit">{TYPE_ICONS.transit}</div>
        <div className="transit-info">
          <span className="transit-mode-tag">{item.transitMode ?? '\u79FB\u52D5'}</span>
          <span className="transit-name">{item.name}</span>
          <span className="transit-time">
            {item.startTime && item.endTime && `${item.startTime}\u2013${item.endTime} \u00B7 `}
            {item.durationMinutes} {'\u5206\u9418'}
          </span>
          {item.costMin > 0 && <span className="transit-cost">{formatCost(item.costMin, item.costMax)}</span>}
        </div>
      </div>
    );
  }

  // Locked in edit mode: can drag, but cannot delete or replace
  const isLockedInEdit = editing && item.locked;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`item-card item-card--${item.type} ${isActive ? 'active' : ''} ${item.locked ? 'locked' : ''} ${isReplacing ? 'replacing' : ''} ${editing ? 'edit-mode' : ''}`}
    >
      <div className="item-left">
        {editing && (
          <div className="drag-handle" {...attributes} {...listeners} title={'\u62D6\u62C9\u6392\u5E8F'}>{'\u2807'}</div>
        )}
        <div className={`item-icon item-icon--${item.type}`}>
          {TYPE_ICONS[item.type]}
        </div>
      </div>
      <div
        className="item-content"
        onClick={() => {
          if (isLockedInEdit) return; // locked: block replace
          onClick();
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' && !isLockedInEdit) onClick(); }}
      >
        <div className="item-top-row">
          <div className="item-time">
            {item.startTime && item.endTime
              ? `${item.startTime}\u2013${item.endTime}`
              : item.startTime ?? ''}
          </div>
          <div className="item-tags">
            {item.locked && <span className="tag tag--locked"><Lock size={11} style={{ verticalAlign: 'text-bottom', marginRight: 2 }} /> {'\u9396\u5B9A'}</span>}
            {item.type === 'attraction' && item.category && (
              <span className={`tag tag--${item.category}`}>
                {item.category === 'indoor' ? '\u{1F3DB}\uFE0F \u5BA4\u5167' : '\u{1F333} \u6236\u5916'}
              </span>
            )}
            {item.type === 'meal' && item.mealType && (
              <span className="tag tag--meal">{MEAL_LABELS[item.mealType]}</span>
            )}
            {item.type === 'lodging' && (
              <span className="tag tag--lodging">{'\u4F4F\u5BBF'}</span>
            )}
          </div>
        </div>
        <h4 className="item-name">
          {item.name}
          {item.placeDetails?.googleMapsUrl && (
            <a
              className="gmaps-link"
              href={item.placeDetails.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              <MapPinned size={12} style={{ verticalAlign: 'text-bottom', marginRight: 2 }} /> Google Maps
            </a>
          )}
        </h4>
        {item.placeDetails?.photoUrl && (
          <div className="item-photo">
            <img src={item.placeDetails.photoUrl} alt={item.name} loading="lazy" />
          </div>
        )}
        {item.address && <div className="item-address">{item.address}</div>}
        <p className="item-desc">{item.description}</p>
        <div className="item-meta">
          <span className="item-cost">{formatCost(item.costMin, item.costMax)}</span>
          {item.durationMinutes > 0 && item.type !== 'lodging' && (
            <span><Clock size={12} style={{ verticalAlign: 'text-bottom', marginRight: 2 }} /> {item.durationMinutes} {'\u5206\u9418'}</span>
          )}
          {item.placeDetails?.rating && (
            <span className="item-rating">
              <Star size={12} style={{ verticalAlign: 'text-bottom', marginRight: 2 }} /> {item.placeDetails.rating.toFixed(1)}
              {item.placeDetails.userRatingCount && (
                <span className="rating-count">({item.placeDetails.userRatingCount.toLocaleString()})</span>
              )}
            </span>
          )}
        </div>
        {editing && !isLockedInEdit && (
          <div className="item-edit-hint"><RefreshCw size={11} style={{ verticalAlign: 'text-bottom', marginRight: 3 }} /> {'\u9EDE\u64CA\u66FF\u63DB\u6B64\u9805\u76EE'}</div>
        )}
      </div>
      {/* Actions only in edit mode */}
      {editing && (
        <div className="item-actions item-actions--visible">
          <button className="action-btn lock-btn" onClick={onToggleLock} title={item.locked ? '\u89E3\u9396' : '\u9396\u5B9A'}>
            {item.locked ? <Lock size={14} /> : <Unlock size={14} />}
          </button>
          {!item.locked && (
            <button className="action-btn delete-btn" onClick={onDelete} title={'\u522A\u9664'}>{'\u2715'}</button>
          )}
        </div>
      )}
    </div>
  );
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr + 'T00:00:00');
  const weekdays = ['\u65E5', '\u4E00', '\u4E8C', '\u4E09', '\u56DB', '\u4E94', '\u516D'];
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const w = weekdays[date.getDay()];
  return `${m}/${d} (${w})`;
}
