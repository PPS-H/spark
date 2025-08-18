class AutomaticROICalculationService {
  // Industry average revenue per stream/view by platform
  private static readonly PLATFORM_RATES = {
    spotify: 0.003,
    youtube: 0.002,
    deezer: 0.0025,
    appleMusic: 0.004,
    amazonMusic: 0.003,
  };

  // Revenue split (70/25/5)
  private static readonly REVENUE_SPLIT = {
    artist: 0.7,
    investors: 0.25,
    platform: 0.05,
  };

  /**
   * Automatically calculate Expected ROI based on artist's historical performance
   */
  static async calculateAutomaticROI(
    project: any,
    historicalData: any,
    verificationData: any
  ): Promise<any> {
    try {
      // Get baseline metrics from verified platforms
      const baselineMetrics = this.extractBaselineMetrics(verificationData);

      // Calculate projected performance based on historical data
      const projectedPerformance = this.calculateProjectedPerformance(
        historicalData,
        baselineMetrics,
        project.genre,
        project.duration
      );

      // Calculate revenue projections
      const revenueProjections =
        this.calculateRevenueProjections(projectedPerformance);

      console.log("revenueProjections:::::", revenueProjections);

      // Apply 70/25/5 split
      const roiCalculation = this.applyRevenueSplit(revenueProjections);

      // **Calculate Expected ROI Percentage correctly**
      const fundingGoalAmount = parseFloat(project.fundingGoal);

      console.log("ROI Calculation Data:", {
        totalGrossRevenue: roiCalculation.totalGrossRevenue,
        investorShare: roiCalculation.investorShare,
        fundingGoal: fundingGoalAmount,
        ratio: roiCalculation.investorShare / fundingGoalAmount,
      });

      const expectedROIPercentage = this.calculateExpectedROIPercentage(
        roiCalculation.investorShare,
        fundingGoalAmount
      );

      console.log("Expected ROI Percentage:", expectedROIPercentage);

      // Validate ROI makes sense
      if (expectedROIPercentage < -50 || expectedROIPercentage > 500) {
        console.warn(
          "ROI percentage seems unrealistic:",
          expectedROIPercentage
        );
        // Apply fallback ROI based on industry standards
        const fallbackROI = this.calculateFallbackROI(
          project.genre,
          project.duration
        );
        console.log("Using fallback ROI:", fallbackROI);
        return {
          ...roiCalculation,
          expectedROIPercentage: fallbackROI,
          isFallback: true,
          // ... rest of the return object
        };
      }

      return {
        ...roiCalculation,
        expectedROIPercentage,
        projectedPerformance,
        baselineMetrics,
        methodology: this.getCalculationMethodology(),
        confidence: this.calculateConfidenceScore(
          historicalData,
          baselineMetrics
        ),
        disclaimer:
          "ROI calculated based on historical performance data and industry averages. Actual results may vary.",
      };
    } catch (error) {
      console.error("Error calculating automatic ROI:", error);
      throw new Error("Failed to calculate automatic ROI");
    }
  }

  static calculateInvestorReturnFromROI(
    investmentAmount: number,
    expectedROIPercentage: number,
    totalFundingGoal: number
  ): any {
    // Ownership percentage of total funding
    const ownershipPercentage = (investmentAmount / totalFundingGoal) * 100;

    // Calculate projected profit and return
    const projectedProfit = investmentAmount * (expectedROIPercentage / 100);
    const projectedReturn = investmentAmount + projectedProfit;

    // Calculate share of the 25% investor portion
    const shareOfInvestorPortion = ownershipPercentage; // Since it's proportional

    return {
      investmentAmount,
      ownershipPercentage: Math.round(ownershipPercentage * 100) / 100,
      projectedReturn: Math.round(projectedReturn * 100) / 100,
      projectedProfit: Math.round(projectedProfit * 100) / 100,
      expectedROIPercentage: expectedROIPercentage,
      shareOfInvestorPortion: Math.round(shareOfInvestorPortion * 100) / 100,
      disclaimer:
        "You will receive your proportional share of the 25% investor revenue. Returns depend on actual project performance.",
    };
  }

  /**
   * Extract baseline metrics from platform verification data
   */
  private static extractBaselineMetrics(verificationData: any): any {
    const metrics = {
      spotify: {
        popularity: 0,
        followers: 0,
        trackCount: 0,
      },
      youtube: {
        subscribers: 0,
        averageViews: 0,
        videoCount: 0,
      },
      deezer: {
        rank: 0,
        fanCount: 0,
      },
    };

    // Extract Spotify metrics
    if (verificationData.spotify?.trackData) {
      metrics.spotify.popularity =
        verificationData.spotify.trackData.popularity || 0;
      // Additional Spotify metrics would come from artist profile API calls
    }

    // Extract YouTube metrics
    if (verificationData.youtube?.trackData) {
      metrics.youtube.averageViews =
        verificationData.youtube.trackData.viewCount || 0;
      metrics.youtube.subscribers =
        verificationData.youtube.trackData.channelSubscribers || 0;
    }

    // Extract Deezer metrics
    if (verificationData.deezer?.trackData) {
      metrics.deezer.rank = verificationData.deezer.trackData.rank || 0;
    }

    return metrics;
  }

  /**
   * Calculate projected performance based on historical data and baseline metrics
   */
  private static calculateProjectedPerformance(
    historicalData: any,
    baselineMetrics: any,
    genre: string,
    duration: string
  ): any {
    // Get genre and duration multipliers
    const genreMultiplier = this.getGenreMultiplier(genre);
    const durationMultiplier = this.getDurationMultiplier(duration);

    // Calculate base monthly performance from historical data
    const baseMonthlyStreams = {
      spotify:
        historicalData?.platforms?.spotify?.streams ||
        this.estimateFromPopularity(baselineMetrics.spotify.popularity),
      youtube:
        historicalData?.platforms?.youtube?.views ||
        this.estimateFromSubscribers(baselineMetrics.youtube.subscribers),
      deezer:
        historicalData?.platforms?.deezer?.streams ||
        this.estimateFromRank(baselineMetrics.deezer.rank),
    };

    // Apply multipliers and project over duration
    const durationInMonths = this.getDurationInMonths(duration);

    const projectedStreams = {
      spotify: Math.round(
        baseMonthlyStreams.spotify *
          genreMultiplier *
          durationMultiplier *
          durationInMonths
      ),
      youtube: Math.round(
        baseMonthlyStreams.youtube *
          genreMultiplier *
          durationMultiplier *
          durationInMonths
      ),
      deezer: Math.round(
        baseMonthlyStreams.deezer *
          genreMultiplier *
          durationMultiplier *
          durationInMonths
      ),
    };

    return projectedStreams;
  }

  /**
   * Calculate revenue projections from stream projections
   */
  private static calculateRevenueProjections(projectedStreams: any): any {
    const revenueProjections = {
      spotify: projectedStreams.spotify * this.PLATFORM_RATES.spotify,
      youtube: projectedStreams.youtube * this.PLATFORM_RATES.youtube,
      deezer: projectedStreams.deezer * this.PLATFORM_RATES.deezer,
    };

    const totalGrossRevenue = Object.values(revenueProjections).reduce(
      (sum: number, revenue: number) => sum + revenue,
      0
    );

    return {
      platformRevenues: revenueProjections,
      totalGrossRevenue: Math.round(totalGrossRevenue * 100) / 100,
      projectedStreams,
    };
  }

  /**
   * Apply 70/25/5 revenue split
   */
  private static applyRevenueSplit(revenueProjections: any): any {
    const totalRevenue = revenueProjections.totalGrossRevenue;

    return {
      totalGrossRevenue: totalRevenue,
      artistShare:
        Math.round(totalRevenue * this.REVENUE_SPLIT.artist * 100) / 100,
      investorShare:
        Math.round(totalRevenue * this.REVENUE_SPLIT.investors * 100) / 100,
      platformFee:
        Math.round(totalRevenue * this.REVENUE_SPLIT.platform * 100) / 100,
      revenueBreakdown: revenueProjections.platformRevenues,
      projectedStreams: revenueProjections.projectedStreams,
    };
  }

  private static calculateFallbackROI(genre: string, duration: string): number {
    // Industry average ROI by genre (annual %)
    const genreROI: { [key: string]: number } = {
      pop: 12,
      "hip-hop": 15,
      electronic: 10,
      rock: 8,
      "r&b": 11,
      country: 9,
      indie: 7,
      jazz: 5,
      classical: 4,
      folk: 6,
    };
    const durationMultipliers: { [key: string]: number } = {
      "6_months": 0.5,
      "1_year": 1.0,
      "2_years": 1.8,
      "5_years": 3.5,
      lifetime: 5.0,
    };

    const baseROI = genreROI[genre?.toLowerCase()] || 8;
    const multiplier = durationMultipliers[duration] || 1.0;

    return Math.round(baseROI * multiplier * 10) / 10;
  }

  // Helper methods for estimation
  private static estimateFromPopularity(popularity: number): number {
    // Spotify popularity is 0-100, estimate monthly streams
    if (popularity >= 80) return 50000; // Very popular
    if (popularity >= 60) return 25000; // Popular
    if (popularity >= 40) return 10000; // Moderate
    if (popularity >= 20) return 5000; // Low
    return 1000; // Very low/new
  }

  private static estimateFromSubscribers(subscribers: number): number {
    // Estimate monthly views based on subscriber count
    if (subscribers >= 100000) return subscribers * 0.5; // 50% engagement
    if (subscribers >= 10000) return subscribers * 0.3; // 30% engagement
    if (subscribers >= 1000) return subscribers * 0.2; // 20% engagement
    return Math.max(subscribers * 0.1, 500); // 10% minimum 500
  }

  private static estimateFromRank(rank: number): number {
    // Deezer rank estimation (higher rank = more popular)
    if (rank >= 500000) return 20000; // Very popular
    if (rank >= 100000) return 10000; // Popular
    if (rank >= 50000) return 5000; // Moderate
    if (rank >= 10000) return 2000; // Low
    return 500; // Very low/new
  }

  private static getGenreMultiplier(genre: string): number {
    const genreMultipliers: { [key: string]: number } = {
      pop: 1.3,
      "hip-hop": 1.4,
      electronic: 1.2,
      rock: 1.1,
      "r&b": 1.2,
      country: 1.0,
      indie: 1.0,
      jazz: 0.8,
      classical: 0.7,
      folk: 0.9,
    };

    return genreMultipliers[genre?.toLowerCase()] || 1.0;
  }

  private static getDurationMultiplier(duration: string): number {
    const durationMultipliers: { [key: string]: number } = {
      "6_months": 0.8,
      "1_year": 1.0,
      "2_years": 1.3,
      "5_years": 1.8,
      lifetime: 2.5,
    };

    return durationMultipliers[duration] || 1.0;
  }

  private static getDurationInMonths(duration: string): number {
    const durationMap: { [key: string]: number } = {
      "6_months": 6,
      "1_year": 12,
      "2_years": 24,
      "5_years": 60,
      lifetime: 120, // 10 years
    };

    return durationMap[duration] || 12;
  }

  private static calculateConfidenceScore(
    historicalData: any,
    baselineMetrics: any
  ): number {
    let confidence = 50; // Base confidence

    // Increase confidence based on historical data availability
    if (historicalData?.platforms?.spotify?.streams > 0) confidence += 15;
    if (historicalData?.platforms?.youtube?.views > 0) confidence += 15;
    if (historicalData?.monthlyRevenue > 0) confidence += 10;

    // Increase confidence based on current platform presence
    if (baselineMetrics.spotify.popularity > 0) confidence += 5;
    if (baselineMetrics.youtube.subscribers > 1000) confidence += 5;

    return Math.min(confidence, 85); // Cap at 85%
  }

  private static getCalculationMethodology(): string {
    return "ROI calculated using: (1) Historical streaming performance data, (2) Current platform metrics from verification, (3) Genre-specific performance multipliers, (4) Industry-standard revenue per stream rates, (5) 70/25/5 revenue split model";
  }

  /**
   * Calculate individual investor's automatic ROI projection
   */
  static calculateInvestorAutomaticROI(
    investmentAmount: number,
    totalFundingGoal: number,
    totalInvestorShare: number,
    confidence: number
  ): any {
    const investorPercentage = investmentAmount / totalFundingGoal;
    const projectedReturn = totalInvestorShare * investorPercentage;
    const projectedProfit = projectedReturn - investmentAmount;
    const roiPercentage =
      investmentAmount > 0 ? (projectedProfit / investmentAmount) * 100 : 0;

    return {
      investmentAmount,
      ownershipPercentage: Math.round(investorPercentage * 10000) / 100,
      projectedReturn: Math.round(projectedReturn * 100) / 100,
      projectedProfit: Math.round(projectedProfit * 100) / 100,
      roiPercentage: Math.round(roiPercentage * 100) / 100,
      confidence: confidence,
      riskLevel: this.determineRiskLevel(confidence, roiPercentage),
      disclaimer:
        "Projections based on historical data and industry averages. Not guaranteed.",
    };
  }

  static calculateExpectedROIPercentage(
    totalInvestorShare: number, // Total $ going to investors (25% of gross revenue)
    totalFundingGoal: number // Total $ needed from investors
  ): number {
    if (totalFundingGoal <= 0) return 0;

    // ✅ CORRECT: Expected ROI = (Return / Investment - 1) * 100
    // Return = totalInvestorShare, Investment = totalFundingGoal
    const roiPercentage = (totalInvestorShare / totalFundingGoal - 1) * 100;

    return Math.round(roiPercentage * 10) / 10; // Round to 1 decimal place
  }

  private static determineRiskLevel(
    confidence: number,
    roiPercentage: number
  ): string {
    if (confidence >= 75 && roiPercentage > 0) return "Low";
    if (confidence >= 60 && roiPercentage > 0) return "Medium";
    if (confidence >= 40) return "Medium-High";
    return "High";
  }
}

export default AutomaticROICalculationService;
