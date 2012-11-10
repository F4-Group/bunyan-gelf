# Bunyan-gelf

A Bunyan writable stream that sends log records to a Graylog2 server or other GELF compatible log management system.

## Features

* Handles complex data by flattening it before sending to gelf.
* Perform basic field mappings between bunyan and gelf fields.
* Send any non-default gelf field as additional field (prefixed with _)

## Documentation

Checkout the tests for now