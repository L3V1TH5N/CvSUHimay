// file path: web/src/components/UserAvatar.jsx

import { getAvatarColor } from '../utils/avatarColor';

/**
 * Reusable avatar component that shows:
 * - uploaded image (priority)
 * - fallback: colored circle with user's initials
 *
 * Props:
 *   user: object with { id, full_name, avatar_url }
 *   size: number (width/height in pixels, default 36)
 *   className: additional CSS classes
 *   ring: boolean (if true, adds a subtle ring matching the avatar color)
 */
const UserAvatar = ({ user, size = 36, className = '', ring = false }) => {
  if (!user) return null;

  const { id, full_name, avatar_url } = user;
  const bgColor = getAvatarColor(id);
  const initial = (full_name?.charAt(0) || 'U').toUpperCase();

  // If avatar URL exists, show image
  if (avatar_url) {
    return (
      <img
        src={avatar_url}
        alt={full_name || 'Avatar'}
        className={`object-cover rounded-full ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  // Fallback: colored circle with initial
  const ringStyle = ring ? { boxShadow: `0 0 0 2px ${bgColor}` } : {};

  return (
    <div
      className={`flex items-center justify-center rounded-full font-semibold text-[color:var(--color-fg)] ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: bgColor,
        fontSize: size * 0.4,
        ...ringStyle,
      }}
    >
      {initial}
    </div>
  );
};

export default UserAvatar;