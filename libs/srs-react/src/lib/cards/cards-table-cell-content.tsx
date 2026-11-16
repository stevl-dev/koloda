import { MARKDOWN_IMAGE_MARK } from "@koloda/srs";
import { ImageIcon, Table } from "@koloda/ui";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Fragment } from "react";

type CardsTableCellContentProps = { value: string };

export function CardsTableCellContent({ value }: CardsTableCellContentProps) {
  const { _ } = useLingui();

  return (
    // WHY: the table has no fixed width, so text that cannot wrap would widen its column. Taking the
    // cell out of the flow keeps the column widths; the row's height comes from the action cells.
    <Table.CellContent variants={{ size: "full", class: "flex items-center" }}>
      <span className="min-w-0 truncate">
        {value.split(MARKDOWN_IMAGE_MARK).map((text, i) => (
          <Fragment key={i}>
            {i > 0 && (
              <ImageIcon
                className="inline size-4 align-text-bottom fg-level-3"
                role="img"
                aria-label={_(msg`cards-table.content.image`)}
              />
            )}
            {text}
          </Fragment>
        ))}
      </span>
    </Table.CellContent>
  );
}
