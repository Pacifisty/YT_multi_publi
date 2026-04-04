export interface ChannelToggleItem {
  id: string;
  youtubeChannelId: string;
  title: string;
  handle?: string;
  thumbnailUrl?: string;
  isActive: boolean;
}

export interface ChannelToggleListProps {
  channels: ChannelToggleItem[];
  onToggle?: (channelId: string, isActive: boolean) => void;
}

export interface ChannelToggleListView {
  items: ChannelToggleItemView[];
  isEmpty: boolean;
  activeCount: number;
  totalCount: number;
}

export interface ChannelToggleItemView {
  channel: ChannelToggleItem;
  label: string;
  ariaLabel: string;
}

export function buildChannelToggleListView(props: ChannelToggleListProps): ChannelToggleListView {
  if (props.channels.length === 0) {
    return { items: [], isEmpty: true, activeCount: 0, totalCount: 0 };
  }

  const items: ChannelToggleItemView[] = props.channels.map((channel) => ({
    channel,
    label: channel.handle ? `${channel.title} (${channel.handle})` : channel.title,
    ariaLabel: `Toggle ${channel.title} ${channel.isActive ? 'off' : 'on'}`,
  }));

  return {
    items,
    isEmpty: false,
    activeCount: props.channels.filter((ch) => ch.isActive).length,
    totalCount: props.channels.length,
  };
}
