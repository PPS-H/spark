import axios from 'axios';
import SpotifyOAuthService from './spotifyAPIService';
class MetadataVerificationService {
  private spotifyService: SpotifyOAuthService;

  constructor() {
    this.spotifyService = new SpotifyOAuthService();
  }

  // Main verification function with multi-platform support
  async verifyProjectMetadata(projectData: any): Promise<any> {
    const verificationResults = {
      spotify: null,
      youtube: null,
      deezer: null,
      overall: {
        isVerified: false,
        confidence: 0,
        errors: [] as string[],
        warnings: [] as string[],
        platformsVerified: 0,
        totalPlatforms: 0
      }
    };

    try {
      // Count total platforms to verify
      let totalPlatforms = 1; // Spotify is required
      if (projectData.youtubeVideoId || projectData.youtubeMusicLink) totalPlatforms++;
      if (projectData.deezerTrackId || projectData.deezerTrackLink) totalPlatforms++;

      verificationResults.overall.totalPlatforms = totalPlatforms;

      // **SPOTIFY VERIFICATION (Required)**
      const spotifyTrackId = projectData.spotifyTrackId || this.extractSpotifyTrackId(projectData.spotifyTrackLink);

      // if (!spotifyTrackId) {
      //   verificationResults.overall.errors.push('Invalid Spotify track link or missing track ID');
      //   return verificationResults;
      // }


      if (projectData.spotifyTrackId) {
        verificationResults.spotify = await this.verifySpotifyTrack(
          spotifyTrackId,
          projectData.songTitle,
          projectData.artistName,
          projectData.isrcCode
        );

        if (verificationResults.spotify?.found) {
          verificationResults.overall.platformsVerified++;
        }
      }
      // **YOUTUBE VERIFICATION (Optional)**
      if (projectData.youtubeVideoId || projectData.youtubeMusicLink) {
        const youtubeVideoId = projectData.youtubeVideoId || this.extractYouTubeVideoId(projectData.youtubeMusicLink);

        if (youtubeVideoId) {
          verificationResults.youtube = await this.verifyYouTubeTrack(
            youtubeVideoId,
            projectData.songTitle,
            projectData.artistName
          );

          if (verificationResults.youtube?.found) {
            verificationResults.overall.platformsVerified++;
          }
        } else {
          verificationResults.overall.warnings.push('Invalid YouTube link provided');
        }
      }

      // **DEEZER VERIFICATION (Optional)**
      if (projectData.deezerTrackId || projectData.deezerTrackLink) {
        const deezerTrackId = projectData.deezerTrackId || this.extractDeezerTrackId(projectData.deezerTrackLink);

        if (deezerTrackId) {
          verificationResults.deezer = await this.verifyDeezerTrack(
            deezerTrackId,
            projectData.songTitle,
            projectData.artistName,
            projectData.isrcCode
          );

          if (verificationResults.deezer?.found) {
            verificationResults.overall.platformsVerified++;
          }
        } else {
          verificationResults.overall.warnings.push('Invalid Deezer link provided');
        }
      }

      // **CALCULATE OVERALL CONFIDENCE**
      verificationResults.overall.confidence = this.calculateOverallConfidence(verificationResults);

      // **DETERMINE VERIFICATION STATUS**
      const minRequiredConfidence = 85;
      const spotifyPassed = verificationResults.spotify?.found &&
        (verificationResults.spotify.titleMatch + verificationResults.spotify.artistMatch) / 2 >= 80;

      if (spotifyPassed && verificationResults.overall.confidence >= minRequiredConfidence) {
        verificationResults.overall.isVerified = true;
      } else if (verificationResults.overall.confidence >= 70) {
        verificationResults.overall.warnings.push('Metadata partially matches - manual review recommended');
      } else {
        verificationResults.overall.errors.push('Metadata verification failed - insufficient match confidence');
      }

      // **ADD SPECIFIC VALIDATION MESSAGES**
      this.addValidationMessages(verificationResults);

      return verificationResults;

    } catch (error: any) {
      console.error('Error verifying project metadata:', error);
      verificationResults.overall.errors.push('Verification service temporarily unavailable');
      return verificationResults;
    }
  }

  // **SPOTIFY VERIFICATION** (Same as before)
  private async verifySpotifyTrack(trackId: string, expectedTitle: string, expectedArtist: string, expectedISRC?: string): Promise<any> {
    try {
      const token = await this.getSpotifyClientCredentialsToken();

      const response = await axios.get(`https://api.spotify.com/v1/tracks/${trackId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const track = response.data;

      const titleMatch = this.calculateSimilarity(track.name, expectedTitle);
      const artistMatch = this.calculateSimilarity(track.artists[0].name, expectedArtist);
      const isrcMatch = expectedISRC ? track.external_ids?.isrc === expectedISRC : false;

      return {
        found: true,
        titleMatch,
        artistMatch,
        isrcMatch,
        platform: 'spotify',
        trackData: {
          id: track.id,
          name: track.name,
          artist: track.artists[0].name,
          album: track.album.name,
          isrc: track.external_ids?.isrc,
          upc: track.album.external_ids?.upc,
          popularity: track.popularity,
          release_date: track.album.release_date,
          duration_ms: track.duration_ms,
          preview_url: track.preview_url
        }
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        return { found: false, platform: 'spotify', error: 'Track not found on Spotify' };
      }
      return { found: false, platform: 'spotify', error: error.message };
    }
  }

  // **YOUTUBE VERIFICATION**
  private async verifyYouTubeTrack(videoId: string, expectedTitle: string, expectedArtist: string): Promise<any> {
    try {
      const response = await axios.get(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${videoId}&key=${process.env.YOUTUBE_API_KEY}`
      );

      const videos = response.data.items;
      if (!videos || videos.length === 0) {
        return { found: false, platform: 'youtube', error: 'Video not found on YouTube' };
      }

      const video = videos[0];
      const titleMatch = this.calculateSimilarity(video.snippet.title, expectedTitle);

      // Check if artist name appears in title or channel name
      const titleArtistMatch = this.calculateSimilarity(video.snippet.title, expectedArtist);
      const channelArtistMatch = this.calculateSimilarity(video.snippet.channelTitle, expectedArtist);
      const artistMatch = Math.max(titleArtistMatch, channelArtistMatch);

      return {
        found: true,
        titleMatch,
        artistMatch,
        platform: 'youtube',
        trackData: {
          id: video.id,
          title: video.snippet.title,
          channelTitle: video.snippet.channelTitle,
          publishedAt: video.snippet.publishedAt,
          duration: video.contentDetails.duration,
          viewCount: parseInt(video.statistics?.viewCount || '0'),
          likeCount: parseInt(video.statistics?.likeCount || '0'),
          description: video.snippet.description?.substring(0, 200) + '...' // Truncate description
        }
      };
    } catch (error: any) {
      return { found: false, platform: 'youtube', error: error.message };
    }
  }

  // **DEEZER VERIFICATION**
  private async verifyDeezerTrack(trackId: string, expectedTitle: string, expectedArtist: string, expectedISRC?: string): Promise<any> {
    try {
      const response = await axios.get(`https://api.deezer.com/track/${trackId}`);
      const track = response.data;

      if (track.error) {
        return { found: false, platform: 'deezer', error: 'Track not found on Deezer' };
      }

      const titleMatch = this.calculateSimilarity(track.title, expectedTitle);
      const artistMatch = this.calculateSimilarity(track.artist.name, expectedArtist);
      const isrcMatch = expectedISRC ? track.isrc === expectedISRC : false;

      return {
        found: true,
        titleMatch,
        artistMatch,
        isrcMatch,
        platform: 'deezer',
        trackData: {
          id: track.id,
          title: track.title,
          artist: track.artist.name,
          album: track.album.title,
          isrc: track.isrc,
          duration: track.duration,
          rank: track.rank, // Deezer popularity score
          release_date: track.release_date,
          preview_url: track.preview
        }
      };
    } catch (error: any) {
      return { found: false, platform: 'deezer', error: error.message };
    }
  }

  // **EXTRACT VIDEO/TRACK IDs FROM LINKS**
  private extractSpotifyTrackId(spotifyLink: string): string | null {
    if (!spotifyLink) return null;
    const patterns = [
      /spotify:track:([a-zA-Z0-9]{22})/,
      /open\.spotify\.com\/track\/([a-zA-Z0-9]{22})/,
      /^([a-zA-Z0-9]{22})$/
    ];

    for (const pattern of patterns) {
      const match = spotifyLink.match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  private extractYouTubeVideoId(youtubeLink: string): string | null {
    if (!youtubeLink) return null;
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|music\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
      /^([a-zA-Z0-9_-]{11})$/
    ];

    for (const pattern of patterns) {
      const match = youtubeLink.match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  private extractDeezerTrackId(deezerLink: string): string | null {
    if (!deezerLink) return null;
    const patterns = [
      /deezer\.com\/track\/(\d+)/,
      /^(\d+)$/
    ];

    for (const pattern of patterns) {
      const match = deezerLink.match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  // **CALCULATE OVERALL CONFIDENCE ACROSS PLATFORMS**
  private calculateOverallConfidence(results: any): number {
    let totalScore = 0;
    let platformCount = 0;

    // Spotify (required, higher weight)
    if (results.spotify?.found) {
      const spotifyScore = (results.spotify.titleMatch + results.spotify.artistMatch) / 2;
      totalScore += spotifyScore * 1.5; // 1.5x weight for Spotify
      platformCount += 1.5;
    }

    // YouTube (optional, normal weight)
    if (results.youtube?.found) {
      const youtubeScore = (results.youtube.titleMatch + results.youtube.artistMatch) / 2;
      totalScore += youtubeScore;
      platformCount += 1;
    }

    // Deezer (optional, normal weight)
    if (results.deezer?.found) {
      const deezerScore = (results.deezer.titleMatch + results.deezer.artistMatch) / 2;
      totalScore += deezerScore;
      platformCount += 1;
    }

    return platformCount > 0 ? Math.round(totalScore / platformCount) : 0;
  }

  // **ADD VALIDATION MESSAGES**
  private addValidationMessages(results: any): void {
    // Spotify validation messages
    if (results.spotify?.found) {
      if (results.spotify.titleMatch < 80) {
        results.overall.warnings.push('Spotify: Song title does not closely match');
      }
      if (results.spotify.artistMatch < 80) {
        results.overall.warnings.push('Spotify: Artist name does not closely match');
      }
      if (!results.spotify.isrcMatch) {
        results.overall.warnings.push('Spotify: ISRC code does not match');
      }
    } else {
      results.overall.errors.push('Spotify verification failed - track not found or inaccessible');
    }

    // YouTube validation messages
    if (results.youtube && !results.youtube.found) {
      results.overall.warnings.push('YouTube: Video not found or inaccessible');
    } else if (results.youtube?.found) {
      if (results.youtube.titleMatch < 70) {
        results.overall.warnings.push('YouTube: Video title does not closely match song title');
      }
      if (results.youtube.artistMatch < 70) {
        results.overall.warnings.push('YouTube: Channel or title does not closely match artist name');
      }
    }

    // Deezer validation messages
    if (results.deezer && !results.deezer.found) {
      results.overall.warnings.push('Deezer: Track not found or inaccessible');
    } else if (results.deezer?.found) {
      if (results.deezer.titleMatch < 80) {
        results.overall.warnings.push('Deezer: Song title does not closely match');
      }
      if (results.deezer.artistMatch < 80) {
        results.overall.warnings.push('Deezer: Artist name does not closely match');
      }
    }
  }

  // **UTILITY FUNCTIONS** (Same as before)
  private async getSpotifyClientCredentialsToken(): Promise<string> {
    try {
      const response = await axios.post('https://accounts.spotify.com/api/token',
        'grant_type=client_credentials',
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`
          }
        }
      );

      return response.data.access_token;
    } catch (error) {
      console.error('Error getting Spotify client credentials token:', error);
      throw new Error('Failed to authenticate with Spotify API');
    }
  }

  private calculateSimilarity(str1: string, str2: string): number {
    if (!str1 || !str2) return 0;

    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();

    if (s1 === s2) return 100;

    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;

    if (longer.length === 0) return 100;

    const distance = this.levenshteinDistance(longer, shorter);
    return Math.round(((longer.length - distance) / longer.length) * 100);
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }
}

export default MetadataVerificationService;
