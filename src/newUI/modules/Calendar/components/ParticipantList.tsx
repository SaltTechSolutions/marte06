import type { CalendarParticipant } from '../types';
import { Badge } from '../../../primitives/Badge';
import { Button } from '../../../primitives/Button';
import './calendar.css';

export type ParticipantListProps = {
  participants: CalendarParticipant[];
  onMarkAttendance?: (participantId: string, status: CalendarParticipant['status']) => void;
};

const statusLabels: Record<CalendarParticipant['status'], string> = {
  scheduled: 'Planlandı',
  attended: 'Katıldı',
  absent: 'Gelmedi',
};

export const ParticipantList = ({ participants, onMarkAttendance }: ParticipantListProps) => {
  if (!participants.length) {
    return null;
  }

  return (
    <div className="participant-list">
      <h4>Katılımcılar</h4>
      <ul className="participant-list__items">
        {participants.map((participant) => (
          <li key={participant.id} className="participant-list__item">
            <div className="participant-list__info">
              <span className="participant-list__name">
                {participant.name}
                {participant.isWalkIn && <Badge variant="warning">Walk-in</Badge>}
              </span>
              <Badge variant={participant.status === 'absent' ? 'danger' : participant.status === 'attended' ? 'success' : 'neutral'}>
                {statusLabels[participant.status]}
              </Badge>
            </div>
            {onMarkAttendance && (
              <div className="participant-list__actions">
                <Button
                  size="sm"
                  tone="ghost"
                  variant="neutral"
                  onClick={() => onMarkAttendance(participant.id, 'attended')}
                >
                  Katıldı
                </Button>
                <Button
                  size="sm"
                  tone="ghost"
                  variant="neutral"
                  onClick={() => onMarkAttendance(participant.id, 'absent')}
                >
                  Gelmedi
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};
