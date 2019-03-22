#!/usr/bin/env python3
import sys
import pathlib
import json
import csv
import os
from pathlib import Path


def main():
    must_be_filepath = sys.argv[1]
    json_file = pathlib.Path(must_be_filepath)
    assert json_file.is_file()

    csv_file = Path(json_file.parent) / Path(json_file.stem + ".csv")
    if csv_file.exists():
        print("Overwriting {}".format(csv_file.as_posix()))

    with json_file.open() as fp:
        content = json.load(fp)

        assert content.__class__ == list
        assert len(content) > 0

        # keys of the first value will be columns
        columns = [x for x in content[0].keys()]

        with csv_file.open(mode="w") as fw:
            fw_csv = csv.DictWriter(fw, columns)

            for row in content:
                fw_csv.writerow(row)


if __name__ == "__main__":
    main()
