<?php

namespace App\Services\Credits;

class CreditContext
{
    public ?int $userId = null;
    public ?string $purpose = null;
    public ?string $tutorPreset = null;
    public ?array $debugSubject = null;

    public function run(int $userId, callable $callback, ?string $purpose = null, ?string $tutorPreset = null, ?array $debugSubject = null): mixed
    {
        $previous = $this->userId;
        $previousPurpose = $this->purpose;
        $previousPreset = $this->tutorPreset;
        $previousSubject = $this->debugSubject;
        $this->userId = $userId;
        $this->purpose = $purpose;
        $this->tutorPreset = $tutorPreset;
        $this->debugSubject = $debugSubject;
        try { return $callback(); }
        finally { $this->userId = $previous; $this->purpose = $previousPurpose; $this->tutorPreset = $previousPreset; $this->debugSubject = $previousSubject; }
    }
}
