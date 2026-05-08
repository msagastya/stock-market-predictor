#!/bin/bash
# Google Cloud deployment script
# Run this once to set everything up

set -e

PROJECT_ID="stock-market-predictor-$(date +%s | tail -c 6)"
REGION="asia-south1"  # Mumbai — closest to Zerodha
SERVICE_NAME="stock-market-app"
TRADING_SECRET=$(openssl rand -hex 32)

echo "========================================"
echo "  Stock Market Predictor — GCP Deploy"
echo "========================================"
echo ""

# Step 1: Create project
echo "Creating GCP project: $PROJECT_ID"
gcloud projects create $PROJECT_ID --name="Stock Market Predictor"
gcloud config set project $PROJECT_ID

# Step 2: Enable billing (user must do this manually)
echo ""
echo "⚠️  IMPORTANT: Enable billing at:"
echo "   https://console.cloud.google.com/billing/linkedaccount?project=$PROJECT_ID"
echo ""
read -p "Press Enter after enabling billing..."

# Step 3: Enable required APIs
echo "Enabling APIs..."
gcloud services enable \
    run.googleapis.com \
    cloudscheduler.googleapis.com \
    cloudbuild.googleapis.com \
    secretmanager.googleapis.com \
    --project=$PROJECT_ID

# Step 4: Store secrets in Secret Manager
echo "Storing secrets..."
echo -n "$TRADING_SECRET" | gcloud secrets create TRADING_SECRET --data-file=- --project=$PROJECT_ID

# Read .env.local and store each key
while IFS='=' read -r key value; do
    [[ "$key" =~ ^#.*$ ]] && continue
    [[ -z "$key" ]] && continue
    echo -n "$value" | gcloud secrets create "$key" --data-file=- --project=$PROJECT_ID 2>/dev/null || true
done < .env.local

# Step 5: Build and deploy to Cloud Run
echo "Building and deploying..."
gcloud run deploy $SERVICE_NAME \
    --source . \
    --region $REGION \
    --platform managed \
    --allow-unauthenticated \
    --port 1803 \
    --memory 512Mi \
    --cpu 1 \
    --min-instances 1 \
    --max-instances 3 \
    --set-env-vars "NODE_ENV=production,PORT=1803" \
    --set-secrets "KITE_API_KEY=KITE_API_KEY:latest,KITE_API_SECRET=KITE_API_SECRET:latest,TRADING_SECRET=TRADING_SECRET:latest,KITE_ACCESS_TOKEN=KITE_ACCESS_TOKEN:latest" \
    --project=$PROJECT_ID

# Get the deployed URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region $REGION --format 'value(status.url)' --project=$PROJECT_ID)

echo ""
echo "✅ App deployed at: $SERVICE_URL"

# Step 6: Set up Cloud Scheduler
echo "Setting up trading schedule..."

# 9:15 AM IST = 3:45 AM UTC
gcloud scheduler jobs create http trading-morning-run \
    --location $REGION \
    --schedule "45 3 * * 1-5" \
    --uri "$SERVICE_URL/api/trading/run" \
    --http-method POST \
    --headers "x-trading-secret=$TRADING_SECRET,Content-Type=application/json" \
    --message-body "{}" \
    --time-zone "UTC" \
    --project=$PROJECT_ID

# 3:15 PM IST = 9:45 AM UTC — intraday exit
gcloud scheduler jobs create http trading-intraday-exit \
    --location $REGION \
    --schedule "45 9 * * 1-5" \
    --uri "$SERVICE_URL/api/trading/intraday-exit" \
    --http-method POST \
    --headers "x-trading-secret=$TRADING_SECRET,Content-Type=application/json" \
    --message-body "{}" \
    --time-zone "UTC" \
    --project=$PROJECT_ID

echo ""
echo "========================================"
echo "  ✅ DEPLOYMENT COMPLETE"
echo "========================================"
echo ""
echo "  App URL:        $SERVICE_URL"
echo "  Trading Secret: $TRADING_SECRET"
echo "  Region:         $REGION (Mumbai)"
echo ""
echo "  ⚠️  UPDATE ZERODHA REDIRECT URL TO:"
echo "  $SERVICE_URL/api/kite/callback"
echo ""
echo "  IMPORTANT: Save your Trading Secret:"
echo "  $TRADING_SECRET"
echo "========================================"
