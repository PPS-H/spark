import { google } from 'googleapis';

class YouTubeOAuthService {
  private oauth2Client: any;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.YOUTUBE_CLIENT_ID,
      process.env.YOUTUBE_CLIENT_SECRET,
      process.env.YOUTUBE_REDIRECT_URI
    );
  }

  // Generate authorization URL
  getAuthorizationUrl(userId: string): string {
    const scopes = [
      'https://www.googleapis.com/auth/youtube.readonly',
      'https://www.googleapis.com/auth/youtube.channel-memberships.creator',
      'https://www.googleapis.com/auth/youtubepartner'
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: userId,
      prompt: 'consent'
    });
  }

  // Exchange code for tokens
  async exchangeCodeForToken(code: string): Promise<any> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      return tokens;
    } catch (error) {
      console.error('Error exchanging YouTube code for token:', error);
      throw new Error('Failed to authenticate with YouTube');
    }
  }

  // Get user's YouTube channel data
  async getChannelData(accessToken: string, refreshToken: string): Promise<any> {
    this.oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken
    });

    const youtube = google.youtube({ version: 'v3', auth: this.oauth2Client });

    try {
      // Get user's channels
      const channelsResponse = await youtube.channels.list({
        part: ['snippet', 'statistics', 'contentDetails'],
        mine: true
      });

      const channel = channelsResponse.data.items?.[0];
      if (!channel) throw new Error('No YouTube channel found');

      // Get channel's recent videos
      //@ts-ignore
      const searchResponse = await youtube.search.list({
        part: ['snippet'],
        channelId: channel.id,
        type: 'video',
        order: 'date',
        maxResults: 50
      });

      // Get detailed video statistics
      //@ts-ignore
      const videoIds = searchResponse.data.items?.map(video => video.id?.videoId).filter(Boolean) || [];
      const videoStatsResponse = await youtube.videos.list({
        part: ['statistics', 'snippet'],
        id: videoIds
      });

      // Get channel analytics (requires YouTube Partner Program)
      let analytics = null;
      try {
        const youtubeAnalytics = google.youtubeAnalytics({ version: 'v2', auth: this.oauth2Client });
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const analyticsResponse = await youtubeAnalytics.reports.query({
          ids: `channel==${channel.id}`,
          startDate: startDate,
          endDate: endDate,
          metrics: 'estimatedRevenue,views,subscribersGained',
          dimensions: 'day'
        });

        analytics = analyticsResponse.data;
      } catch (analyticsError) {
        console.log('YouTube Analytics not available (may require YouTube Partner Program)');
      }

      return {
        channel: {
          id: channel.id,
          title: channel.snippet?.title,
          description: channel.snippet?.description,
          subscriberCount: parseInt(channel.statistics?.subscriberCount || '0'),
          videoCount: parseInt(channel.statistics?.videoCount || '0'),
          viewCount: parseInt(channel.statistics?.viewCount || '0')
        },
        recentVideos: videoStatsResponse.data.items || [],
        analytics: analytics
      };
    } catch (error) {
      console.error('Error getting YouTube channel data:', error);
      throw new Error('Failed to fetch YouTube channel data');
    }
  }
}


export default YouTubeOAuthService;