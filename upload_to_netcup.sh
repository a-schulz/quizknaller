#!/bin/bash
# Upload QuizKnaller to Netcup via SFTP

echo "🚀 Uploading QuizKnaller to Netcup..."
echo ""
echo "SFTP Connection Details:"
echo "  Host: 202.61.232.187"
echo "  User: hosting181513"
echo "  Target: /rubberducking.ninja/"
echo ""
echo "Creating deployment zip..."
cd /Users/SchulA75/Downloads/mpquiz/netcup_deploy
zip -r quizknaller.zip quizknaller/

echo ""
echo "Uploading via SFTP..."
echo "After connecting, run:"
echo "  cd rubberducking.ninja"
echo "  put quizknaller.zip"
echo "  quit"
echo ""
sftp hosting181513@202.61.232.187
