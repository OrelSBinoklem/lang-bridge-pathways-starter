<?php

// Legacy flag retains the existing account gate only. Access and the compatibility
// subscription endpoint are always free, including hosts whose old env says true.
return ['enabled' => env('SUBSCRIPTIONS_ENABLED', false)];
