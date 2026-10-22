import { useConference } from '../lib/store.jsx';
import { Button } from './ui.jsx';
import { Icon } from './Icon.jsx';

/**
 * Follow / Following toggle for a speaker, usable wherever they are shown. State
 * lives in the store, so every other surface updates at once. Render it as a
 * sibling of any link around the speaker, never inside one.
 */
export function FollowButton({ speaker, size = 'sm', className }) {
  const { isFollowing, toggleFollow } = useConference();
  const following = isFollowing(speaker.id);
  return (
    <Button
      variant={following ? 'ghost' : 'primary'}
      size={size}
      className={className}
      onClick={() => toggleFollow(speaker.id)}
      aria-pressed={following}
      aria-label={`${following ? 'Following' : 'Follow'} ${speaker.name}`}
      data-testid="follow-toggle"
    >
      <Icon name={following ? 'check' : 'bell'} className="size-3.5" />
      {following ? 'Following' : 'Follow'}
    </Button>
  );
}
