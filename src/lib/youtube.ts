export interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  thumbnail: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
}

export interface YouTubeChannel {
  id: string;
  title: string;
  description: string;
  customUrl: string;
  avatar: string;
  subscriberCount: number;
  viewCount: number;
  videoCount: number;
  uploadsPlaylistId: string;
}

export const fetchYouTubeChannel = async (accessToken: string): Promise<YouTubeChannel> => {
  const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&mine=true`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    let errMsg = response.statusText;
    try {
      const errData = await response.json();
      if (errData?.error?.message) {
        errMsg = errData.error.message;
      }
    } catch (e) {
      // ignore
    }
    throw new Error(`Failed to fetch channel details: ${errMsg} (Status: ${response.status})`);
  }

  const data = await response.json();
  if (!data.items || data.items.length === 0) {
    throw new Error("No YouTube channel found for this user. Please ensure your Google Account has an active YouTube channel.");
  }

  const item = data.items[0];
  return {
    id: item.id,
    title: item.snippet.title,
    description: item.snippet.description || "",
    customUrl: item.snippet.customUrl || "",
    avatar: item.snippet.thumbnails?.default?.url || "",
    subscriberCount: parseInt(item.statistics.subscriberCount) || 0,
    viewCount: parseInt(item.statistics.viewCount) || 0,
    videoCount: parseInt(item.statistics.videoCount) || 0,
    uploadsPlaylistId: item.contentDetails?.relatedPlaylists?.uploads || "",
  };
};

export const fetchYouTubeVideos = async (accessToken: string, uploadsPlaylistId: string): Promise<YouTubeVideo[]> => {
  const playlistItemsUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=10&playlistId=${uploadsPlaylistId}`;
  const response = await fetch(playlistItemsUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    let errMsg = response.statusText;
    try {
      const errData = await response.json();
      if (errData?.error?.message) {
        errMsg = errData.error.message;
      }
    } catch (e) {
      // ignore
    }
    throw new Error(`Failed to fetch channel videos: ${errMsg} (Status: ${response.status})`);
  }

  const playlistData = await response.json();
  if (!playlistData.items || playlistData.items.length === 0) {
    return [];
  }

  const videoIds = playlistData.items.map((item: any) => item.snippet.resourceId.videoId).join(",");

  const videosUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoIds}`;
  const videosResponse = await fetch(videosUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!videosResponse.ok) {
    let errMsg = videosResponse.statusText;
    try {
      const errData = await videosResponse.json();
      if (errData?.error?.message) {
        errMsg = errData.error.message;
      }
    } catch (e) {
      // ignore
    }
    throw new Error(`Failed to fetch video statistics: ${errMsg} (Status: ${videosResponse.status})`);
  }

  const videosData = await videosResponse.json();
  return videosData.items.map((item: any) => ({
    id: item.id,
    title: item.snippet.title,
    description: item.snippet.description || "",
    publishedAt: item.snippet.publishedAt,
    thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || "",
    viewCount: parseInt(item.statistics.viewCount) || 0,
    likeCount: parseInt(item.statistics.likeCount) || 0,
    commentCount: parseInt(item.statistics.commentCount) || 0,
  }));
};
