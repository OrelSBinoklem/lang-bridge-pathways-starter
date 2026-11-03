<?php

namespace App\Services\Credits;

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

class CreditStatistics
{
    public function summarize(int $userId, string $period, ?string $date, string $timezone): array
    {
        $anchor = $date ? CarbonImmutable::createFromFormat('!Y-m-d', $date, $timezone) : CarbonImmutable::now($timezone);
        $start = match ($period) {
            'hour' => $anchor->startOfDay(),
            'day' => $anchor->startOfMonth(),
            'month' => $anchor->startOfYear(),
        };
        $end = match ($period) {
            'hour' => $start->addDay(),
            'day' => $start->addMonth(),
            'month' => $start->addYear(),
        };
        $key = fn (CarbonImmutable $time) => $time->format(match ($period) {
            'hour' => 'Y-m-d\TH:00P', 'day' => 'Y-m-d', 'month' => 'Y-m',
        });
        $buckets = [];
        // Advance hours in UTC so both occurrences of a DST hour retain their offset.
        for ($cursor = $start->utc(); $cursor->lessThan($end); $cursor = match ($period) {
            'hour' => $cursor->addHour(),
            'day' => $cursor->setTimezone($timezone)->addDay()->utc(),
            'month' => $cursor->setTimezone($timezone)->addMonth()->utc(),
        }) {
            $local = $cursor->setTimezone($timezone);
            $buckets[$key($local)] = ['start' => $local->toIso8601String(), 'incoming_micros' => 0, 'spent_micros' => 0, 'operations' => 0];
        }
        $totals = ['incoming_micros' => 0, 'spent_micros' => 0, 'operations' => 0];
        $operations = DB::table('credit_operations')->where('user_id', $userId)->where('status', 'settled')
            ->where('created_at', '>=', $start->utc()->toDateTimeString())
            ->where('created_at', '<', $end->utc()->toDateTimeString())->where('amount_micros', '!=', 0)
            ->orderBy('created_at')->cursor(['created_at', 'amount_micros']);
        foreach ($operations as $operation) {
            $bucket = $key(CarbonImmutable::parse($operation->created_at, 'UTC')->setTimezone($timezone));
            $amount = (int) $operation->amount_micros;
            $series = $amount > 0 ? 'incoming_micros' : 'spent_micros';
            $buckets[$bucket][$series] += abs($amount);
            $buckets[$bucket]['operations']++;
            $totals[$series] += abs($amount);
            $totals['operations']++;
        }

        return ['period' => $period, 'date' => $start->toDateString(), 'timezone' => $timezone,
            'start' => $start->toIso8601String(), 'end' => $end->toIso8601String(),
            'buckets' => array_values($buckets), 'totals' => $totals];
    }
}
