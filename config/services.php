<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Resend, Postmark, AWS, and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'google' => [
        'client_id' => env('GOOGLE_CLIENT_ID'),
        'client_secret' => env('GOOGLE_CLIENT_SECRET'),
        'redirect' => env('GOOGLE_REDIRECT_URI', env('APP_URL').'/auth/google/callback'),
    ],

    'openai' => [
        'key' => env('OPENAI_API_KEY'),
        'exam_transcription_primary' => env('EXAM_TRANSCRIPTION_PRIMARY_MODEL', 'gpt-transcribe'),
        'exam_transcription_secondary' => env('EXAM_TRANSCRIPTION_SECONDARY_MODEL', 'gpt-4o-transcribe'),
        'embedding_model' => env('OPENAI_EMBEDDING_MODEL', env('OPENAI_MESSAGE_EMBEDDING_MODEL', 'text-embedding-3-large')),
        'message_embedding_model' => env('OPENAI_MESSAGE_EMBEDDING_MODEL', env('OPENAI_EMBEDDING_MODEL', 'text-embedding-3-large')),
        'summary_embedding_model' => env('OPENAI_SUMMARY_EMBEDDING_MODEL', 'text-embedding-3-large'),
        'context_summary_model' => env('OPENAI_CONTEXT_SUMMARY_MODEL', 'gpt-5.4'),
        'embedding_dimensions' => (int) env('OPENAI_EMBEDDING_DIMENSIONS', 1536),
        'embed_tutor_messages_sync' => filter_var(env('OPENAI_EMBED_TUTOR_MESSAGES_SYNC', true), FILTER_VALIDATE_BOOLEAN),
    ],

];
