<?php

namespace App\Services\Credits;

class CreditException extends \RuntimeException
{
    public function __construct(string $message = 'Недостаточно кредитов для AI-запроса.', public int $status = 402)
    {
        parent::__construct($message);
    }

    public function render()
    {
        return response()->json(['message' => $this->getMessage(), 'code' => 'credits_unavailable'], $this->status);
    }
}
