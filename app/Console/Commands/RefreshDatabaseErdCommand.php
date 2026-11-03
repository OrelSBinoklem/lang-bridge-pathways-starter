<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;

class RefreshDatabaseErdCommand extends Command
{
    protected $signature = 'erd:refresh-db {connection? : Database connection name}
        {--file= : Output filename inside laravel-erd storage path}';

    protected $description = 'Generate a Laravel ERD SQL file from the real database schema.';

    public function handle(): int
    {
        $connectionName = $this->argument('connection') ?: config('database.default');
        $connection = DB::connection($connectionName);
        $driver = $connection->getDriverName();

        if (! in_array($driver, ['mysql', 'mariadb'], true)) {
            $this->error("Only MySQL/MariaDB is supported, got [{$driver}].");

            return self::FAILURE;
        }

        $database = $connection->getDatabaseName();
        $tables = $this->tables($connection, $database);
        $foreignKeys = $this->foreignKeys($connection, $database);
        $sql = $this->renderSql($tables, $foreignKeys);

        $storagePath = (string) config('laravel-erd.storage_path', storage_path('framework/cache/laravel-erd'));
        $extension = (string) config('laravel-erd.extension', 'sql');
        $file = $this->option('file') ?: "{$connectionName}.{$extension}";
        $path = $storagePath.'/'.$file;

        File::ensureDirectoryExists($storagePath);
        File::put($path, $sql);

        $this->info("ERD SQL refreshed: {$path}");

        return self::SUCCESS;
    }

    /**
     * @return array<string, array<int, object>>
     */
    private function tables(ConnectionInterface $connection, string $database): array
    {
        $rows = $connection->select(
            <<<'SQL'
            select
                table_name,
                column_name,
                column_type,
                is_nullable,
                column_default,
                extra,
                column_key,
                column_comment,
                ordinal_position
            from information_schema.columns
            where table_schema = ?
            order by table_name, ordinal_position
            SQL,
            [$database],
        );

        $tables = [];
        foreach ($rows as $row) {
            $tables[$row->table_name] ??= [];
            $tables[$row->table_name][] = $row;
        }

        ksort($tables);

        return $tables;
    }

    /**
     * @return array<int, object>
     */
    private function foreignKeys(ConnectionInterface $connection, string $database): array
    {
        return $connection->select(
            <<<'SQL'
            select
                table_name,
                column_name,
                referenced_table_name,
                referenced_column_name,
                constraint_name,
                ordinal_position
            from information_schema.key_column_usage
            where table_schema = ?
                and referenced_table_name is not null
            order by table_name, constraint_name, ordinal_position
            SQL,
            [$database],
        );
    }

    /**
     * @param array<string, array<int, object>> $tables
     * @param array<int, object> $foreignKeys
     */
    private function renderSql(array $tables, array $foreignKeys): string
    {
        $blocks = [];

        foreach ($tables as $table => $columns) {
            $lines = [];
            $primaryKeys = [];

            foreach ($columns as $column) {
                $line = sprintf(
                    '    %s %s%s%s%s%s',
                    $this->id($column->column_name),
                    $column->column_type,
                    $column->is_nullable === 'NO' ? ' NOT NULL' : '',
                    $column->column_default !== null ? ' DEFAULT '.$this->defaultValue((string) $column->column_default) : '',
                    str_contains((string) $column->extra, 'auto_increment') ? ' AUTO_INCREMENT' : '',
                    $column->column_comment ? ' COMMENT '.$this->quote((string) $column->column_comment) : '',
                );

                $lines[] = $line;
                if ($column->column_key === 'PRI') {
                    $primaryKeys[] = $this->id($column->column_name);
                }
            }

            if ($primaryKeys !== []) {
                $lines[] = '    PRIMARY KEY ('.implode(', ', $primaryKeys).')';
            }

            $blocks[] = "CREATE TABLE {$this->id($table)} (\n".implode(",\n", $lines)."\n);";
        }

        foreach ($foreignKeys as $fk) {
            $blocks[] = sprintf(
                'ALTER TABLE %s ADD CONSTRAINT %s FOREIGN KEY (%s) REFERENCES %s (%s);',
                $this->id($fk->table_name),
                $this->id($fk->constraint_name),
                $this->id($fk->column_name),
                $this->id($fk->referenced_table_name),
                $this->id($fk->referenced_column_name),
            );
        }

        return implode("\n\n", $blocks)."\n";
    }

    private function id(string $value): string
    {
        return '`'.str_replace('`', '``', $value).'`';
    }

    private function quote(string $value): string
    {
        return "'".str_replace("'", "''", $value)."'";
    }

    private function defaultValue(string $value): string
    {
        $upper = strtoupper($value);
        if (in_array($upper, ['CURRENT_TIMESTAMP', 'CURRENT_TIMESTAMP()', 'NULL'], true)) {
            return $upper;
        }

        return is_numeric($value) ? $value : $this->quote($value);
    }
}
