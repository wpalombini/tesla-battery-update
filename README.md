# Tesla Powerwall Battery Reserve Scheduler

This AWS Lambda function automatically adjusts the minimum battery reserve percentage on Tesla Powerwall systems to optimize energy usage and costs throughout the day.

## Purpose

The system implements a time-based battery management strategy that:

- **At midnight AEST (2:00 PM UTC)**: Sets the battery reserve to **40%**, maximizing battery storage during off-peak hours when electricity rates are typically lower
- **At 6:00 AM AEST (8:00 PM UTC)**: Reduces the battery reserve to **20%**, allowing the stored energy to be used throughout the day while maintaining a minimum backup reserve

This approach helps reduce electricity costs by storing energy during cheaper off-peak periods and making it available for consumption during peak rate hours.

## How it Works

The system consists of two scheduled Lambda functions:

1. **Midnight Reserve (40%)**: Triggered at midnight AEST to maximize battery charging during off-peak hours
2. **Morning Reserve (20%)**: Triggered at 6:00 AM AEST to release stored energy for daily usage while keeping essential backup power

## Architecture

- **AWS Lambda**: Serverless functions handle the Tesla API interactions
- **CloudWatch Events**: Scheduled triggers for automated execution
- **Tesla Energy API**: Direct communication with Powerwall systems

## Configuration

The system requires Tesla API credentials stored as environment variables:

- `TESLA_REFRESH_TOKEN`: Your Tesla account refresh token
- `TESLA_CLIENT_ID`: Tesla API client ID
- `TESLA_CLIENT_SECRET`: Tesla API client secret

## Deployment

Deploy using the Serverless Framework:

```bash
npm run deploy
```

The deployment creates two scheduled functions in the `ap-southeast-2` AWS region (Sydney) to align with AEST timing.

## Benefits

- **Cost Savings**: Maximizes use of cheaper off-peak electricity rates
- **Energy Optimization**: Ensures battery is fully charged during low-cost periods
- **Automated Management**: No manual intervention required once deployed
- **Backup Protection**: Maintains minimum 20% reserve for emergency power needs
