# AI Data Explorer - Comprehensive Demo Script

This demo showcases the multi-agent capabilities of the AI Data Explorer by investigating a product quality issue from customer sentiment through to root cause analysis using weather data.

## Demo Scenario
We'll investigate automotive parts with quality issues, tracing from negative customer reviews through warranty claims to identify weather-related failure patterns.

---

## Step 1: Identify Products with Negative Reviews

**What this demonstrates:** Product analyst agent with Bedrock Knowledge Base integration and sentiment analysis

**Explanation:** We start by analyzing customer reviews stored in our Bedrock Knowledge Base to identify products receiving overwhelmingly negative feedback. The product analyst agent has access to review data and can perform sentiment analysis.

```
Analyze customer reviews for our Premium Oil Filter and identify the most common complaints. Summarize the negative feedback and provide sentiment analysis. Focus on reviews with 1-2 star ratings and highlight any patterns in the complaints.
```

---

## Step 2: Generate Word Cloud of Review Complaints

**What this demonstrates:** Data visualization agent creating word clouds from text data extracted by product analyst

**Explanation:** Create a visual representation of the most common complaint terms from negative reviews to quickly identify recurring issues.

```
Create a word cloud from the negative Premium Oil Filter reviews, focusing on the complaint keywords and failure modes mentioned by customers. 
```

---

## Step 3: Query Graph Database for Production Batches

**What this demonstrates:** Schema agent converting queries to graph format and Neptune database integration

**Explanation:** Now we'll examine production data for the problematic Premium Oil Filter using our graph database to understand which production batches are associated with warranty claims.

```
Query our graph database to find all production batches for Premium Oil Filter and show which batches have the most warranty claims. Include facility and production line information.
```

---

## Step 4: Analyze Warranty Claims for Problem Batches

**What this demonstrates:** Data analysis with filtering and pattern recognition

**Explanation:** Examine warranty claims data to understand failure patterns, timing, and geographic distribution of issues for the specific production batches identified.

```
Analyze warranty claims for Premium Oil Filter focusing on the production batches with the most claims. Show me failure modes, claim dates, and customer locations. Group by failure cause and look for patterns in timing and geography.
```

---

## Step 5: Visualize Geographic Distribution of Claims

**What this demonstrates:** Data visualization with geographic analysis and date range filtering

**Explanation:** Create visualizations to identify if warranty claims are concentrated in specific geographic regions during certain time periods.

```
Create a pie chart showing warranty claims by state for Premium Oil Filter, and a timeline chart showing when claims occurred. Focus on identifying seasonal patterns and geographic concentrations.
```

---

## Step 6: Cross-Reference with Customer Reviews

**What this demonstrates:** Multi-source data correlation using knowledge base and structured data

**Explanation:** Connect the warranty claims analysis back to customer reviews to see if customers mentioned specific failure modes or conditions in their feedback that match our warranty claim patterns.

```
Search the Premium Oil Filter reviews for mentions of cold weather, winter conditions, or temperature-related failures. Compare the review dates and locations with our warranty claim patterns to validate the cold weather correlation.
```

---

## Step 7: Generate Executive Summary Report

**What this demonstrates:** Help assistant creating comprehensive reports with recommendations

**Explanation:** Synthesize all findings into a comprehensive report with actionable recommendations for product improvement and quality control.

```
Create an executive summary report of our Premium Oil Filter quality investigation. Include: 1) Customer sentiment analysis from reviews, 2) Production batch analysis, 3) Warranty claim patterns by geography and failure mode, 4) Correlation between customer complaints and warranty data, 5) Recommended corrective actions for the most common failure modes, 6) Suggested improvements to gasket and seal materials.
```

---

## Step 8: Generate Visualizations

```
Create visualizations to support the most important findings in the Premium Oil Filter quality investigation report.
```


## Current Test Data Status

✅ **Available Data:**
- Product catalog (`Product.csv`)
- Customer reviews in Bedrock Knowledge Base (`Reviews-PremFilter.csv`, etc.)
- Warranty claims with detailed failure modes (`WarrantyClaim.csv`)
- Production batch data (`ProductionBatch.csv`)
- Graph database schema with relationships
- Facility and supplier information

---

## Demo Tips

1. **Timing:** Allow 20-25 minutes for the complete demo
2. **Preparation:** 
   - Ensure Neptune graph database is populated and accessible
   - Verify Bedrock Knowledge Base contains review data
   - Test weather API connectivity
3. **Audience Engagement:** 
   - Emphasize the multi-agent collaboration
   - Highlight how different data sources (KB, graph DB, external APIs) work together
   - Show the progression from customer feedback to root cause
4. **Fallbacks:** Have static weather data ready if API is unavailable
5. **Variations:** Audience can suggest different products or failure modes to investigate

---

## Expected Outcomes

By the end of this demo, viewers will see:
- ✅ Knowledge Base integration for unstructured data (reviews)
- ✅ Sentiment analysis and text processing
- ✅ Word cloud generation from customer feedback
- ✅ Graph database querying for production relationships
- ✅ Data visualization (pie charts, timelines, correlations)
- ✅ Geographic and temporal analysis
- ✅ Weather API integration for environmental factors
- ✅ Multi-agent collaboration across data sources
- ✅ Root cause analysis methodology
- ✅ Executive reporting and recommendations

This demonstrates the AI Data Explorer's ability to combine structured data (CSV, graph DB), unstructured data (knowledge base), and external APIs (weather) through intelligent multi-agent analysis to solve complex business problems.
