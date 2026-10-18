-- Consultas read-only a executar depois que o projeto Neon existir.
select current_database() as database_name, pg_database_size(current_database())::bigint as database_bytes;
select count(*) as pilot_trips from viaggio_lab.trips;
select coalesce(sum(size_bytes),0)::bigint as indexed_file_bytes from viaggio_lab.files;
-- Importante: indexed_file_bytes soma metadados cadastrados; o uso REAL dos objetos deve vir do Neon Storage/Management API, não desta tabela.
