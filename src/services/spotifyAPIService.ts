import axios from 'axios';

class SpotifyOAuthService {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor() {
    this.clientId = process.env.SPOTIFY_CLIENT_ID!;
    this.clientSecret = process.env.SPOTIFY_CLIENT_SECRET!;
    this.redirectUri = process.env.SPOTIFY_REDIRECT_URI!;
  }

  // Generate authorization URL for frontend
  getAuthorizationUrl(userId: string): string {
    const scopes = [
      'user-read-private',
      'user-read-email', 
      'user-top-read',
      'playlist-read-private',
      'streaming',
      'user-library-read'
    ].join(' ');

    console.log('Spotify Authorization URL:', this.redirectUri,this.clientId, scopes, userId);

    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: this.redirectUri,
      scope: scopes,
      state: userId, // Pass userId as state for security
      show_dialog: 'true'
    });

    return `https://accounts.spotify.com/authorize?${params.toString()}`;
  }

  // Exchange authorization code for access token
  async exchangeCodeForToken(code: string, state: string): Promise<any> {
    try {
      const response = await axios.post('https://accounts.spotify.com/api/token', {
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: this.redirectUri,
        client_id: this.clientId,
        client_secret: this.clientSecret
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      return {
        access_token: response.data.access_token,
        refresh_token: response.data.refresh_token,
        expires_in: response.data.expires_in,
        userId: state
      };
    } catch (error) {
      console.error('Error exchanging Spotify code for token:', error);
      throw new Error('Failed to authenticate with Spotify');
    }
  }

  // Get user's actual streaming data
  async getUserStreamingData(accessToken: string): Promise<any> {
    try {
      const headers = { 'Authorization': `Bearer ${accessToken}` };

      // Get user profile
      const profileResponse = await axios.get('https://api.spotify.com/v1/me', { headers });
      
      // Get user's top tracks (last 4 weeks, 6 months, all time)
      const [shortTermTracks, mediumTermTracks, longTermTracks] = await Promise.all([
        axios.get('https://api.spotify.com/v1/me/top/tracks?time_range=short_term&limit=50', { headers }),
        axios.get('https://api.spotify.com/v1/me/top/tracks?time_range=medium_term&limit=50', { headers }),
        axios.get('https://api.spotify.com/v1/me/top/tracks?time_range=long_term&limit=50', { headers })
      ]);

      // Get user's playlists to analyze engagement
      const playlistsResponse = await axios.get('https://api.spotify.com/v1/me/playlists?limit=50', { headers });

      return {
        profile: profileResponse.data,
        topTracks: {
          shortTerm: shortTermTracks.data.items,
          mediumTerm: mediumTermTracks.data.items,
          longTerm: longTermTracks.data.items
        },
        playlists: playlistsResponse.data.items,
        totalFollowers: profileResponse.data.followers.total
      };
    } catch (error) {
      console.error('Error getting Spotify user data:', error);
      throw new Error('Failed to fetch Spotify streaming data');
    }
  }

  // Refresh access token
  async refreshAccessToken(refreshToken: string): Promise<any> {
    try {
      const response = await axios.post('https://accounts.spotify.com/api/token', {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      return {
        access_token: response.data.access_token,
        expires_in: response.data.expires_in,
        refresh_token: response.data.refresh_token || refreshToken
      };
    } catch (error) {
      console.error('Error refreshing Spotify token:', error);
      throw new Error('Failed to refresh Spotify token');
    }
  }
}

export default SpotifyOAuthService;
