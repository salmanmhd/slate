## goodsreceived

USE [HRMS]
GO
/****** Object: StoredProcedure [dbo].[SP_CRUD_GoodsReceived] Script Date: 20-08-2026 4.41.11 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

ALTER PROCEDURE [dbo].[SP_CRUD_GoodsReceived]
@payload NVARCHAR(MAX)
AS
BEGIN
SET NOCOUNT ON;
SET XACT_ABORT ON;

    BEGIN TRY
        DECLARE @type NVARCHAR(50) = JSON_VALUE(@payload, '$.type');

        IF @type = 'insert'
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM OPENJSON(@payload, '$.lines')
                WITH (
                    warehouse_id INT '$.warehouse_id',
                    location_id INT '$.location_id'
                ) AS InputLines
                WHERE InputLines.warehouse_id IS NULL OR InputLines.location_id IS NULL
            )
            BEGIN
                RAISERROR('Transaction Aborted: Both warehouse_id and
                location_id must be provided for every line item.', 16, 1);
                RETURN;
            END;

            BEGIN TRANSACTION;

            DECLARE @NewGRNHeaderId INT;

            DECLARE @GeneratedGRNNo NVARCHAR(50) =
                'GRN-' +
                CONVERT(NVARCHAR(8), GETDATE(), 112) + '-' +
                RIGHT('0000' + CAST(NEXT VALUE FOR [dbo].[Seq_GRNNumber] AS NVARCHAR(10)), 4);
            -- A. Direct Insert into GRNHeader Table
            INSERT INTO [dbo].[GRNHeader] (GRNNo, GRNDate, POHeaderId, VendorId, ChallanNo,
                ChallanDate, GateEntryNo, InvoiceNo, ReceivedByUserId,Remarks, GRNStatus,
                IsDeleted, CreatedBy, CreatedDate,ReceivingDocument,[type])
            SELECT @GeneratedGRNNo,
                ISNULL(CAST(JSON_VALUE(@payload, '$.grn_date') AS DATETIME), GETDATE()),
                CAST(JSON_VALUE(@payload, '$.po_header_id') AS INT),
                CAST(JSON_VALUE(@payload, '$.vendor_id') AS INT),JSON_VALUE(@payload, '$.challan_no'),
                CAST(JSON_VALUE(@payload, '$.challan_date') AS DATE),
                JSON_VALUE(@payload, '$.gate_entry_no'), JSON_VALUE(@payload, '$.invoice_no'),
                CAST(JSON_VALUE(@payload, '$.received_by_user_id') AS INT),
                JSON_VALUE(@payload, '$.remarks'),COALESCE(JSON_VALUE(@payload, '$.grn_status'), 'Pending'),
                0,JSON_VALUE(@payload, '$.created_by'),
                GETDATE(),JSON_VALUE(@payload, '$.recdoc'),JSON_VALUE(@payload,'$.type');

            SET @NewGRNHeaderId = SCOPE_IDENTITY();

            INSERT INTO [dbo].[GRNLine] (GRNHeaderId, POLineId, [LineNo], ItemCode, ItemName,
                Unit, QtyReceived, QtyAccepted, QtyRejected,RejectionReason, WarehouseId,
                Remarks, IsDeleted)
            SELECT @NewGRNHeaderId,ParsedLines.POLineId,
                ROW_NUMBER() OVER (ORDER BY (SELECT NULL)),
                ParsedLines.ItemCode,ParsedLines.ItemName,
                ParsedLines.Unit,ParsedLines.QtyReceived,
                ParsedLines.QtyAccepted,ParsedLines.QtyRejected,
                ParsedLines.RejectionReason,ParsedLines.WarehouseId,
                CONCAT('Loc: ', ParsedLines.LocationId, ' | Bay: ', ParsedLines.BayId, ' | Row: ',
                ParsedLines.RowId, ' | Rack: ', ParsedLines.RackId, ' | Shelf: ', ParsedLines.ShelfId,
                ' | Bin: ', ParsedLines.BinId),0
            FROM OPENJSON(@payload, '$.lines')
            WITH (
                POLineId INT '$.po_line_id',
                ItemCode NVARCHAR(100) '$.item_code',ItemName NVARCHAR(200) '$.item_name',
                Unit NVARCHAR(20) '$.unit',QtyReceived INT '$.qty_received',
                QtyAccepted INT '$.qty_accepted',QtyRejected INT '$.qty_rejected',
                RejectionReason NVARCHAR(250) '$.rejection_reason',
                WarehouseId INT '$.warehouse_id',LocationId INT '$.location_id',
                BayId INT '$.bay_id',RowId INT '$.row_id',
                RackId INT '$.rack_id',ShelfId INT '$.shelf_id',BinId INT '$.bin_id'
            ) AS ParsedLines;



            -- Step 1: UPSERT into StockMaster matching the unique constraints
            MERGE [dbo].[StockMaster] AS Target
            USING (SELECT ItemCode, ItemName,
                    WarehouseId,LocationId,MAX(BayId) AS BayId,MAX(RowId) AS RowId,
                    MAX(RackId) AS RackId,MAX(ShelfId) AS ShelfId,MAX(BinId) AS BinId,
                    SUM(QtyAccepted) AS TotalAccepted
                FROM OPENJSON(@payload, '$.lines')
                WITH (
                    ItemCode NVARCHAR(100) '$.item_code',
                    ItemName NVARCHAR(200) '$.item_name',
                    WarehouseId INT '$.warehouse_id',
                    LocationId INT '$.location_id',BayId INT '$.bay_id',
                    RowId INT '$.row_id',RackId INT '$.rack_id',
                    ShelfId INT '$.shelf_id',BinId INT '$.bin_id',
                    QtyAccepted INT '$.qty_accepted'
                )
                WHERE QtyAccepted > 0
                GROUP BY ItemCode, ItemName, WarehouseId, LocationId
            ) AS Source
            ON (
                Target.ItemCode = Source.ItemCode
                AND Target.WarehouseId = Source.WarehouseId
                AND Target.Locationid = Source.LocationId
            )

            WHEN MATCHED THEN
                UPDATE SET
                    Target.QtyOnHand = Target.QtyOnHand + Source.TotalAccepted,
                    -- Update specific layout metadata if provided
                    Target.Bayid = COALESCE(Source.BayId, Target.Bayid),
                    Target.rowid = COALESCE(Source.RowId, Target.rowid),
                    Target.rackid = COALESCE(Source.RackId, Target.rackid),
                    Target.shelfid = COALESCE(Source.ShelfId, Target.shelfid),
                    Target.binid = COALESCE(Source.BinId, Target.binid),
                    Target.LastUpdatedDate = GETDATE()

            WHEN NOT MATCHED THEN
                INSERT (ItemCode, ItemName, WarehouseId, Locationid,
                    Bayid, rowid, rackid, shelfid, binid,
                    QtyOnHand, QtyAllocated, LastUpdatedDate
                )
                VALUES (Source.ItemCode, Source.ItemName, Source.WarehouseId, Source.LocationId,
                    Source.BayId, Source.RowId, Source.RackId, Source.ShelfId, Source.BinId,
                    Source.TotalAccepted, 0, GETDATE()
                );

            -- Audit Logs to StockLedger
            INSERT INTO [dbo].[StockLedger] (
                ItemCode, WarehouseId,LocationId, TransactionType, ReferenceHeaderId,
                ReferenceNo, QtyIn, QtyOut, BalanceAfter, CreatedByUserId, CreatedDate
            )
            SELECT
                InputLines.ItemCode,InputLines.WarehouseId,
                 InputLines.LocationId,'GRN',@NewGRNHeaderId,
                @GeneratedGRNNo,InputLines.QtyAccepted,
                0,
                sm.QtyOnHand, -- Absolute snapshot balance of this item/location combo
                JSON_VALUE(@payload, '$.received_by_user_id'),
                GETDATE()
            FROM OPENJSON(@payload, '$.lines')
            WITH (
                ItemCode NVARCHAR(100) '$.item_code',
                WarehouseId INT '$.warehouse_id',
                LocationId INT '$.location_id',
                QtyAccepted INT '$.qty_accepted'
            ) AS InputLines
            INNER JOIN [dbo].[StockMaster] sm
                ON InputLines.ItemCode = sm.ItemCode
                AND InputLines.WarehouseId = sm.WarehouseId
                AND InputLines.LocationId = sm.Locationid
            WHERE InputLines.QtyAccepted > 0;

            if JSON_VALUE(@payload, '$.typerec')='PO'
            begin
            update poheader set POstatus='Received' where id =JSON_VALUE(@payload, '$.po_header_id')
            end
            COMMIT TRANSACTION;

            SELECT
                Status = 'Success',
                Message = 'GRN processed successfully. Specific warehouse locations updated.',
                GRNHeaderId = @NewGRNHeaderId,
                GRNNo = @GeneratedGRNNo;
        END

    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;

       SELECT 500 AS statuscode,
        CONCAT(
            'SQL Error: ', ERROR_MESSAGE(),
            ' | Line: ', ERROR_LINE(),
            ' | ErrorNo: ', ERROR_NUMBER()
        ) AS StatusMsg;
    END CATCH

END;

## OutwardMovement

USE [HRMS]
GO
/****** Object: StoredProcedure [dbo].[SP_CRUD_OutwardMovement] Script Date: 20-08-2026 4.45.24 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

ALTER PROCEDURE [dbo].[SP_CRUD_OutwardMovement]
@payload NVARCHAR(MAX)
AS
BEGIN
SET NOCOUNT ON;
SET XACT_ABORT ON; -- Automatically rolls back the transaction if a runtime error occurs

    BEGIN TRY
        -- Extract Document Header Data from the JSON Payload
        DECLARE @MovementType NVARCHAR(30) = JSON_VALUE(@payload, '$.movement_type');
        DECLARE @ReferenceNo NVARCHAR(100) = JSON_VALUE(@payload, '$.reference_no');
        DECLARE @RequisitionHeaderId INT   = CAST(JSON_VALUE(@payload, '$.requisition_header_id') AS INT);
        DECLARE @SalesOrderHeaderId INT    = CAST(JSON_VALUE(@payload, '$.sales_order_header_id') AS INT);
        DECLARE @ToWarehouseId INT         = CAST(JSON_VALUE(@payload, '$.to_warehouse_id') AS INT);
        DECLARE @ToLocationId INT          = CAST(JSON_VALUE(@payload, '$.to_location_id') AS INT);
        DECLARE @CustomerId INT            = CAST(JSON_VALUE(@payload, '$.customer_id') AS INT);
        DECLARE @DepartmentId INT          = CAST(JSON_VALUE(@payload, '$.department_id') AS INT);
        DECLARE @VendorServiceId INT       = CAST(JSON_VALUE(@payload, '$.vendor_service_id') AS INT);

        --- change by munazir
        DECLARE @AuthorizedByUserId NVARCHAR(50)    = JSON_VALUE(@payload, '$.authorized_by_user_id');
        --------
        DECLARE @Remarks NVARCHAR(500)     = JSON_VALUE(@payload, '$.remarks');
        DECLARE @CreatedBy  nvarchar(50)   = JSON_VALUE(@payload, '$.created_by');
        Declare @Type nvarchar(50) = JSON_VALUE(@payload, '$.type');
     if @type ='Insert'
     begin
        IF @MovementType NOT IN ('Consumption', 'Allocation', 'Transfer', 'Scrap', 'Sales Return', 'Service Out')
        BEGIN
            RAISERROR('Transaction Aborted: Invalid movement type specified.', 16, 1);
            RETURN;
        END;

        -- Guard Clause B: Verify required keys for Transfer actions
        IF @MovementType = 'Transfer' AND (@ToWarehouseId IS NULL OR @ToLocationId IS NULL)
        BEGIN
            RAISERROR('Transaction Aborted: Transfers require both destination to_warehouse_id and to_location_id.', 16, 1);
            RETURN;
        END;

        -- Create a temporary table variable to cleanly parse, filter, and sequence the array input rows
        DECLARE @ParsedLines TABLE (
            [LineNo] INT IDENTITY(1,1),
            POLineId INT, ItemCode NVARCHAR(100), ItemName NVARCHAR(200), Unit NVARCHAR(20),
            FromWarehouseId INT, FromLocationId INT, FromBayId INT, FromRowId INT, FromRackId INT, FromShelfId INT, FromBinId INT,
            QtyRequested INT, QtyIssued INT, ReasonCode NVARCHAR(50), Remarks NVARCHAR(500)
        );

        INSERT INTO @ParsedLines (
            ItemCode, ItemName, Unit, FromWarehouseId, FromLocationId,
            FromBayId, FromRowId, FromRackId, FromShelfId, FromBinId,
            QtyRequested, QtyIssued, ReasonCode, Remarks
        )
        SELECT
            ItemCode, ItemName, Unit, FromWarehouseId, FromLocationId,
            BayId, RowId, RackId, ShelfId, BinId,
            QtyRequested, QtyIssued, ReasonCode, Remarks
        FROM OPENJSON(@payload, '$.lines')
        WITH (
            ItemCode NVARCHAR(100) '$.item_code',
            ItemName NVARCHAR(200) '$.item_name',
            Unit NVARCHAR(20) '$.unit',
            FromWarehouseId INT '$.from_warehouse_id',
            FromLocationId INT '$.from_location_id',
            BayId INT '$.from_bay_id',
            RowId INT '$.from_row_id',
            RackId INT '$.from_rack_id',
            ShelfId INT '$.from_shelf_id',
            BinId INT '$.from_bin_id',
            QtyRequested INT '$.qty_requested',
            QtyIssued INT '$.qty_issued',
            ReasonCode NVARCHAR(50) '$.reason_code',
            Remarks NVARCHAR(500) '$.remarks'
        )
        WHERE QtyIssued > 0;

        -- Guard Clause C: Verify sufficient physical stock exists across items before initiating locks
        IF @MovementType IN ('Consumption', 'Transfer', 'Scrap', 'Service Out')
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM @ParsedLines p
                LEFT JOIN [dbo].[StockMaster] sm
                    ON p.ItemCode = sm.ItemCode
                    AND p.FromWarehouseId = sm.WarehouseId
                    AND p.FromLocationId = sm.Locationid
                WHERE sm.id IS NULL OR (sm.QtyOnHand < p.QtyIssued)
            )
            BEGIN
                RAISERROR('Transaction Aborted: Insufficient physical stock (QtyOnHand) available for one or more lines.', 16, 1);
                RETURN;
            END;
        END
        ELSE IF @MovementType = 'Allocation'
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM @ParsedLines p
                LEFT JOIN [dbo].[StockMaster] sm
                    ON p.ItemCode = sm.ItemCode
                    AND p.FromWarehouseId = sm.WarehouseId
                    AND p.FromLocationId = sm.Locationid
                WHERE sm.id IS NULL OR ((sm.QtyOnHand - sm.QtyAllocated) < p.QtyIssued)
            )
            BEGIN
                RAISERROR('Transaction Aborted: Insufficient clear unallocated stock (QtyAvailable) available to fulfill reservation request.', 16, 1);
                RETURN;
            END;
        END;

        BEGIN TRANSACTION;

        DECLARE @OutwardHeaderId INT;

        -- Generate Sequence Identity Number: OUT-YYYYMMDD-0001
        DECLARE @GeneratedOutwardNo NVARCHAR(50) =
            'OUT-' +
            CONVERT(NVARCHAR(8), GETDATE(), 112) + '-' +
            RIGHT('0000' + CAST(NEXT VALUE FOR [dbo].[Seq_OutwardNumber] AS NVARCHAR(10)), 4);

        -- A. Document Header Entry
        INSERT INTO [dbo].[OutwardHeader] (
            OutwardNo, OutwardDate, MovementType, ReferenceNo, RequisitionHeaderId,
            SalesOrderHeaderId, ToWarehouseId, ToLocationid, CustomerId, DepartmentId,
            VendorServiceId, AuthorizedByUserId, Remarks, Status, IsDeleted, CreatedBy, CreatedDate
        )
        VALUES (
            @GeneratedOutwardNo, GETDATE(), @MovementType, @ReferenceNo, @RequisitionHeaderId,
            @SalesOrderHeaderId, @ToWarehouseId, @ToLocationId, @CustomerId, @DepartmentId,
            @VendorServiceId, @AuthorizedByUserId, @Remarks, 'Approved', 0, @CreatedBy, GETDATE()
        );

        SET @OutwardHeaderId = SCOPE_IDENTITY();

        -- B. Document Line Item Grid Entries
        INSERT INTO [dbo].[OutwardLine] (
            OutwardHeaderId, [LineNo], ItemCode, ItemName, Unit,
            FromWarehouseId, FromLocationid, FromBayid, FromRowid, FromRackid, FromShelfid, FromBinid,
            QtyRequested, QtyIssued, ReasonCode, Remarks, IsDeleted
        )
        SELECT
            @OutwardHeaderId, [LineNo], ItemCode, ItemName, Unit,
            FromWarehouseId, FromLocationId, FromBayId, FromRowId, FromRackId, FromShelfId, FromBinId,
            QtyRequested, QtyIssued, ReasonCode, Remarks, 0
        FROM @ParsedLines;


       --  change by munazir  PATHWAY 1: BALANCES DECREASE (Consumption, Scrap, Service Out)
            IF @MovementType IN ('Consumption', 'Scrap', 'Service Out')
            BEGIN
                UPDATE sm
                SET
                    sm.QtyOnHand = sm.QtyOnHand - p.QtyIssued,
                    sm.LastUpdatedDate = GETDATE()
                FROM [dbo].[StockMaster] sm
                INNER JOIN @ParsedLines p
                    ON sm.ItemCode = p.ItemCode
                    AND sm.WarehouseId = p.FromWarehouseId
                    AND sm.Locationid = p.FromLocationId;

                -- Log Ledger Entry
                INSERT INTO [dbo].[StockLedger] (
                    ItemCode, WarehouseId, LocationId,
                    TransactionType, ReferenceHeaderId, ReferenceNo, QtyIn, QtyOut, BalanceAfter, CreatedByUserId, CreatedDate
                )
                SELECT
                    p.ItemCode, p.FromWarehouseId, p.FromLocationId,
                    UPPER(@MovementType), @OutwardHeaderId, @GeneratedOutwardNo, 0, p.QtyIssued, sm.QtyOnHand, @CreatedBy, GETDATE()
                FROM @ParsedLines p
                INNER JOIN [dbo].[StockMaster] sm
                    ON p.ItemCode = sm.ItemCode
                    AND p.FromWarehouseId = sm.WarehouseId
                    AND p.FromLocationId = sm.Locationid;

                -- ✅ NEW: Update RequisitionLine received/pending qty
                IF @RequisitionHeaderId IS NOT NULL
                BEGIN
                    UPDATE rl
                    SET
                        rl.ReceivedQty  = rl.ReceivedQty + p.QtyIssued,
                        rl.PendingQty   = CASE
                                            WHEN (rl.RequisitionQty - rl.ReceivedQty - p.QtyIssued) <= 0
                                            THEN 0
                                            ELSE (rl.RequisitionQty - rl.ReceivedQty - p.QtyIssued)
                                            END,
                        rl.LineStatus   = CASE
                                            WHEN (rl.RequisitionQty - rl.ReceivedQty - p.QtyIssued) <= 0
                                            THEN 'Consumed'
                                            ELSE 'PartiallyConsumed'
                                            END
                    FROM [dbo].[RequisitionLine] rl
                    INNER JOIN @ParsedLines p ON rl.ItemCode = p.ItemCode
                    WHERE rl.RequisitionHeaderId = @RequisitionHeaderId
                        AND rl.IsDeleted = 0;

                    -- ✅ NEW: Update RequisitionHeader status based on line completion
                    UPDATE [dbo].[RequisitionHeader]
                    SET
                        ReqStatus    = CASE
                                        -- All lines fully consumed → Consumed
                                        WHEN NOT EXISTS (
                                            SELECT 1 FROM [dbo].[RequisitionLine]
                                            WHERE RequisitionHeaderId = @RequisitionHeaderId
                                                AND IsDeleted = 0
                                                AND LineStatus NOT IN ('Consumed')
                                        ) THEN 'Consumed'

                                        -- At least one line partially consumed → PartiallyConsumed
                                        WHEN EXISTS (
                                            SELECT 1 FROM [dbo].[RequisitionLine]
                                            WHERE RequisitionHeaderId = @RequisitionHeaderId
                                                AND IsDeleted = 0
                                                AND LineStatus IN ('Consumed', 'PartiallyConsumed')
                                        ) THEN 'PartiallyConsumed'

                                        -- Nothing consumed yet → keep existing status
                                        ELSE ReqStatus
                                        END,
                        ModifiedBy   = @CreatedBy,
                        ModifiedDate = GETDATE()
                    WHERE id = @RequisitionHeaderId
                        AND IsDeleted = 0;
                END
            END



        ---- PATHWAY 1: BALANCES DECREASE (Consumption, Scrap, Service Out)
        --IF @MovementType IN ('Consumption', 'Scrap', 'Service Out')
        --BEGIN
        --    UPDATE sm
        --    SET
        --        sm.QtyOnHand = sm.QtyOnHand - p.QtyIssued,
        --        sm.LastUpdatedDate = GETDATE()
        --    FROM [dbo].[StockMaster] sm
        --    INNER JOIN @ParsedLines p
        --        ON sm.ItemCode = p.ItemCode
        --        AND sm.WarehouseId = p.FromWarehouseId
        --        AND sm.Locationid = p.FromLocationId;

        --    -- Log Ledger Entry
        --    INSERT INTO [dbo].[StockLedger] (
        --        ItemCode, WarehouseId, LocationId,   -- ✅ MUST ADD
        --        TransactionType, ReferenceHeaderId, ReferenceNo, QtyIn, QtyOut, BalanceAfter, CreatedByUserId, CreatedDate
        --    )
        --    SELECT
        --        p.ItemCode, p.FromWarehouseId, p.FromLocationId,   -- ✅ MUST ADD
        --        UPPER(@MovementType), @OutwardHeaderId, @GeneratedOutwardNo, 0, p.QtyIssued, sm.QtyOnHand, @CreatedBy, GETDATE()
        --    FROM @ParsedLines p
        --    INNER JOIN [dbo].[StockMaster] sm
        --        ON p.ItemCode = sm.ItemCode AND p.FromWarehouseId = sm.WarehouseId AND p.FromLocationId = sm.Locationid;



        --END

        -- PATHWAY 2: LOCK BALANCES INCREASE (Allocation Reservations)
        ELSE IF @MovementType = 'Allocation'
        BEGIN
            UPDATE sm
            SET
                sm.QtyAllocated = sm.QtyAllocated + p.QtyIssued,
                sm.LastUpdatedDate = GETDATE()
            FROM [dbo].[StockMaster] sm
            INNER JOIN @ParsedLines p
                ON sm.ItemCode = p.ItemCode
                AND sm.WarehouseId = p.FromWarehouseId
                AND sm.Locationid = p.FromLocationId;

            -- Log Ledger Entry (Allocations modify reservation state, physical balance stays un-deducted until dispatch)
            INSERT INTO [dbo].[StockLedger] (
                ItemCode, WarehouseId, TransactionType, ReferenceHeaderId, ReferenceNo, QtyIn, QtyOut, BalanceAfter, CreatedByUserId, CreatedDate
            )
            SELECT
                p.ItemCode, p.FromWarehouseId, 'ALLOCATE', @OutwardHeaderId, @GeneratedOutwardNo, 0, p.QtyIssued, sm.QtyOnHand, @CreatedBy, GETDATE()
            FROM @ParsedLines p
            INNER JOIN [dbo].[StockMaster] sm
                ON p.ItemCode = sm.ItemCode AND p.FromWarehouseId = sm.WarehouseId AND p.FromLocationId = sm.Locationid;
        END

        -- PATHWAY 3: DUAL-SIDED RELOCATION MANAGEMENT (Inter-Warehouse Transfers)
        ELSE IF @MovementType = 'Transfer'
        BEGIN
            -- Deduct stock from the source location
            UPDATE sm
            SET
                sm.QtyOnHand = sm.QtyOnHand - p.QtyIssued,
                sm.LastUpdatedDate = GETDATE()
            FROM [dbo].[StockMaster] sm
            INNER JOIN @ParsedLines p
                ON sm.ItemCode = p.ItemCode
                AND sm.WarehouseId = p.FromWarehouseId
                AND sm.Locationid = p.FromLocationId;

            -- Write Deduction Entry to Ledger
            INSERT INTO [dbo].[StockLedger] (
                ItemCode, WarehouseId,LocationId, TransactionType, ReferenceHeaderId, ReferenceNo, QtyIn, QtyOut, BalanceAfter, CreatedByUserId, CreatedDate
            )
            SELECT
                p.ItemCode, p.FromWarehouseId, p.FromLocationId, 'Transfer_OUT', @OutwardHeaderId, @GeneratedOutwardNo, 0, p.QtyIssued, sm.QtyOnHand, @CreatedBy, GETDATE()
            FROM @ParsedLines p
            INNER JOIN [dbo].[StockMaster] sm
                ON p.ItemCode = sm.ItemCode AND p.FromWarehouseId = sm.WarehouseId AND p.FromLocationId = sm.Locationid;

            -- Add or update stock at the destination location (UPSERT via MERGE)
            MERGE [dbo].[StockMaster] AS Target
            USING (
                SELECT ItemCode, ItemName, @ToWarehouseId AS ToWH, @ToLocationId AS ToLoc, SUM(QtyIssued) AS TotalTransferQty,
                       MAX(FromBayId) AS B, MAX(FromRowId) AS Ro, MAX(FromRackId) AS Ra, MAX(FromShelfId) AS S, MAX(FromBinId) AS Bi
                FROM @ParsedLines GROUP BY ItemCode, ItemName
            ) AS Source
            ON (Target.ItemCode = Source.ItemCode AND Target.WarehouseId = Source.ToWH AND Target.Locationid = Source.ToLoc)
            WHEN MATCHED THEN
                UPDATE SET Target.QtyOnHand = Target.QtyOnHand + Source.TotalTransferQty, Target.LastUpdatedDate = GETDATE()
            WHEN NOT MATCHED THEN
                INSERT (ItemCode, ItemName, WarehouseId, Locationid, Bayid, rowid, rackid, shelfid, binid, QtyOnHand, QtyAllocated, LastUpdatedDate)
                VALUES (Source.ItemCode, Source.ItemName, Source.ToWH, Source.ToLoc, Source.B, Source.Ro, Source.Ra, Source.S, Source.Bi, Source.TotalTransferQty, 0, GETDATE());

            -- Write Addition Entry to Ledger
            INSERT INTO [dbo].[StockLedger] (
                ItemCode, WarehouseId,LocationId, TransactionType, ReferenceHeaderId, ReferenceNo, QtyIn, QtyOut, BalanceAfter, CreatedByUserId, CreatedDate
            )
            SELECT
                p.ItemCode, @ToWarehouseId,p.FromLocationId, 'Transfer_IN', @OutwardHeaderId, @GeneratedOutwardNo, p.QtyIssued, 0, sm.QtyOnHand, @CreatedBy, GETDATE()
            FROM @ParsedLines p
            INNER JOIN [dbo].[StockMaster] sm
                ON p.ItemCode = sm.ItemCode AND sm.WarehouseId = @ToWarehouseId AND sm.Locationid = @ToLocationId;
        END

        -- PATHWAY 4: SYSTEM INTAKE RETURNS (Sales Returns)
        ELSE IF @MovementType = 'Sales Return'
        BEGIN
            MERGE [dbo].[StockMaster] AS Target
            USING (
                SELECT ItemCode, ItemName, FromWarehouseId, FromLocationId, SUM(QtyIssued) AS TotalReturnQty,
                       MAX(FromBayId) AS B, MAX(FromRowId) AS Ro, MAX(FromRackId) AS Ra, MAX(FromShelfId) AS S, MAX(FromBinId) AS Bi
                FROM @ParsedLines GROUP BY ItemCode, ItemName, FromWarehouseId, FromLocationId
            ) AS Source
            ON (Target.ItemCode = Source.ItemCode AND Target.WarehouseId = Source.FromWarehouseId AND Target.Locationid = Source.FromLocationId)
            WHEN MATCHED THEN
                UPDATE SET Target.QtyOnHand = Target.QtyOnHand + Source.TotalReturnQty, Target.LastUpdatedDate = GETDATE()
            WHEN NOT MATCHED THEN
                INSERT (ItemCode, ItemName, WarehouseId, Locationid, Bayid, rowid, rackid, shelfid, binid, QtyOnHand, QtyAllocated, LastUpdatedDate)
                VALUES (Source.ItemCode, Source.ItemName, Source.FromWarehouseId, Source.FromLocationId, Source.B, Source.Ro, Source.Ra, Source.S, Source.Bi, Source.TotalReturnQty, 0, GETDATE());

            -- Write Return Inward Entry to Ledger
            INSERT INTO [dbo].[StockLedger] (
                ItemCode, WarehouseId, TransactionType, ReferenceHeaderId, ReferenceNo, QtyIn, QtyOut, BalanceAfter, CreatedByUserId, CreatedDate
            )
            SELECT
                p.ItemCode, p.FromWarehouseId, 'SALES_RET', @OutwardHeaderId, @GeneratedOutwardNo, p.QtyIssued, 0, sm.QtyOnHand, @CreatedBy, GETDATE()
            FROM @ParsedLines p
            INNER JOIN [dbo].[StockMaster] sm
                ON p.ItemCode = sm.ItemCode AND p.FromWarehouseId = sm.WarehouseId AND p.FromLocationId = sm.Locationid;
        END;

        COMMIT TRANSACTION;

        -- Format Return Success Descriptor block
        --SELECT
        --    Status = 200,
        --    Message = CONCAT('Outward inventory tracking document passed validation rules and executed: ', @MovementType),
        --    OutwardHeaderId = @OutwardHeaderId,
        --    OutwardNo = @GeneratedOutwardNo;

       -- change munazir
        SELECT
            OutwardHeaderId = @OutwardHeaderId,
            OutwardNo = @GeneratedOutwardNo;
        SELECT
            200 AS StatusCode,
            CONCAT('Outward inventory tracking document passed validation rules and executed: ', @MovementType) AS StatusMsg;

    end
    if @Type='stockinhand'
    begin
       select * from  [dbo].[StockMaster]
       WHERE Qtyavailable>0  and Warehouseid=JSON_VALUE(@payload, '$.warehouse_id')
        and locationid=JSON_VALUE(@payload, '$.locationid')
        SELECT 200 StatusCode, 'Stock data fetched successfully' StatusMsg
    end
    --- new add munazir

IF @Type = 'getbyitemcode'
BEGIN
SELECT * FROM [dbo].[StockMaster]
WHERE ItemCode = JSON_VALUE(@payload, '$.item_code');

        -- Appends the corporate status code layout required by your Dapper architecture

        SELECT 200 StatusCode, 'Stock data by item code fetched successfully' StatusMsg
    END

    --- new add by munazir

    if @Type='getallstock'
    begin
       select a.*,b.Category,b.Price from  [dbo].[StockMaster] as a left join
       Products as b on a.ItemCode=b.itemcode


        SELECT 200 StatusCode, 'Stock data fetched successfully' StatusMsg
    end

      --- new add by munazir

    if @Type='getallStockLedger'
    begin
       select a.*,b.ProductName from StockLedger as a
       left join Products as b on a.itemcode=b.ItemCode

       order by a.createddate desc
        SELECT 200 StatusCode, 'Stock Ledger data fetched successfully' StatusMsg
    end

     --- new add by munazir

    if @Type='getStockLedgerbyitemcode'
    begin
      select a.*,b.ProductName from StockLedger as a
       left join Products as b on a.itemcode=b.ItemCode
       where a.itemcode=JSON_VALUE(@payload, '$.item_code') order by createddate desc

        SELECT 200 StatusCode, 'Stock Ledger data fetched successfully' StatusMsg
    end

    if @Type='transferchallanlisting'
    begin
       select * from  [OutwardHeader] where
             MovementType=JSON_VALUE(@payload, '$.movement_type')

      SELECT 200 StatusCode, 'Transfer challan listings fetched successfully' StatusMsg;
    end
    -- if @Type='transferchallandetail'
    --begin
    --   select * from  [OutwardHeader]
    --   --Replace above
    --        -- MovementType=JSON_VALUE(@payload, '$.movement_type')
    --    SELECT 200 StatusCode, 'Transfer challan properties details fetched successfully' StatusMsg;
    --end
    ----- by munazir

    IF @Type = 'transferchallandetail'
    BEGIN
        -- 1. Extract the unique identifier from your JSON payload
        DECLARE @HeaderId INT = CAST(JSON_VALUE(@payload, '$.id') AS INT);

        -- 2. Fetch the Header details
        --SELECT * FROM [dbo].[OutwardHeader]
        --WHERE id = @HeaderId AND IsDeleted = 0;

        -- 3. Fetch the mapped Line Items details
        SELECT * FROM [dbo].[OutwardLine]
        WHERE OutwardHeaderId = @HeaderId AND IsDeleted = 0;

        -- 4. Send back your corporate Dapper status response
        SELECT 200 StatusCode, 'Transfer challan properties details fetched successfully' StatusMsg;
    END


    -- by munazir ===================== CONSUMPTION LISTING =====================
    IF @Type = 'consumptionlisting'
    BEGIN
        SELECT
            oh.id,
            oh.OutwardNo,
            oh.OutwardDate,
            oh.MovementType,
            oh.ReferenceNo,
            oh.RequisitionHeaderId,
            rh.RequisitionNo,                    -- ← from RequisitionHeader
            rh.ReqStatus     AS RequisitionStatus,
            oh.DepartmentId,
            oh.Remarks,
            oh.Status,
            oh.CreatedBy,
            oh.CreatedDate
        FROM [dbo].[OutwardHeader] oh
        LEFT JOIN [dbo].[RequisitionHeader] rh
            ON oh.RequisitionHeaderId = rh.id
        WHERE oh.MovementType = 'Consumption'
          AND oh.IsDeleted = 0
        ORDER BY oh.OutwardDate DESC;

        SELECT 200 AS StatusCode, 'Consumption listing fetched successfully' AS StatusMsg;
    END

    -- ===================== CONSUMPTION DETAIL BY HEADER ID =====================
        IF @Type = 'consumptiondetail'
        BEGIN
            DECLARE @ConsumptionHeaderId INT = CAST(JSON_VALUE(@payload, '$.id') AS INT);

            -- 1. Header info with linked Requisition + IssuedBy name
            SELECT
                oh.id,
                oh.OutwardNo,
                oh.OutwardDate,
                oh.MovementType,
                oh.ReferenceNo,
                oh.RequisitionHeaderId,
                rh.RequisitionNo,
                rh.RequisitionType,
                rh.RequestedByName,
                rh.ReqStatus            AS RequisitionStatus,
                oh.DepartmentId,
                oh.CustomerId,
                oh.AuthorizedByUserId,
                oh.Remarks,
                oh.Status,
                -- ✅ IssuedBy — CreatedBy is EmployeeCode, resolve to name via Employees
                oh.CreatedBy            AS IssuedByCode,
                e.FullName          AS IssuedBy,
                oh.CreatedDate
            FROM [dbo].[OutwardHeader] oh
            LEFT JOIN [dbo].[RequisitionHeader] rh
                ON oh.RequisitionHeaderId = rh.id
            -- ✅ Join Employees on EmployeeCode since CreatedBy stores EmployeeCode
            LEFT JOIN [dbo].[Employees] e
                ON e.EmployeeCode = oh.CreatedBy
            WHERE oh.id = @ConsumptionHeaderId
              AND oh.IsDeleted = 0;

            -- 2. Line items with RequisitionLine qty context + Price from Products
            SELECT
                ol.id,
                ol.OutwardHeaderId,
                ol.[LineNo],
                ol.ItemCode,
                ol.ItemName,
                ol.Unit,
                ol.QtyRequested,
                ol.QtyIssued,
                -- ✅ Price from Products — joined on ItemCode same as getallstock type
                p.Price                             AS ItemPrice,
                ISNULL(p.Price, 0) * ol.QtyIssued  AS TotalAmount,
                ol.ReasonCode,
                ol.Remarks,
                ol.FromWarehouseId,
                ol.FromLocationid,
                -- Requisition line context
                oh.RequisitionHeaderId,
                rl.id                               AS RequisitionLineId,
                rl.RequisitionQty,
                rl.ReceivedQty,
                rl.PendingQty,
                rl.LineStatus                       AS RequisitionLineStatus
            FROM [dbo].[OutwardLine] ol
            INNER JOIN [dbo].[OutwardHeader] oh
                ON ol.OutwardHeaderId = oh.id
            LEFT JOIN [dbo].[RequisitionLine] rl
                ON rl.RequisitionHeaderId = oh.RequisitionHeaderId
                AND rl.ItemCode = ol.ItemCode
                AND rl.IsDeleted = 0
            -- ✅ Same join pattern as getallstock: Products on ItemCode
            LEFT JOIN [dbo].[Products] p
                ON p.ItemCode = ol.ItemCode
            WHERE ol.OutwardHeaderId = @ConsumptionHeaderId
              AND ol.IsDeleted = 0
            ORDER BY ol.[LineNo] ASC;

            SELECT 200 AS StatusCode, 'Consumption detail fetched successfully' AS StatusMsg;
        END

        -- ===================== CONSUMPTION LISTING BY WAREHOUSE =====================
        IF @Type = 'consumptionbywarehouse'
        BEGIN
            DECLARE @WarehouseId INT = CAST(JSON_VALUE(@payload, '$.warehouse_id') AS INT);

            SELECT
                oh.id,
                oh.OutwardNo,
                oh.OutwardDate,
                oh.MovementType,
                oh.ReferenceNo,
                oh.RequisitionHeaderId,
                rh.RequisitionNo,
                rh.ReqStatus        AS RequisitionStatus,
                oh.DepartmentId,
                oh.Remarks,
                oh.Status,
                oh.CreatedBy        AS IssuedByCode,
                e.FullName          AS IssuedBy,
                oh.CreatedDate
            FROM [dbo].[OutwardHeader] oh
            LEFT JOIN [dbo].[RequisitionHeader] rh
                ON oh.RequisitionHeaderId = rh.id
            LEFT JOIN [dbo].[Employees] e
                ON e.EmployeeCode = oh.CreatedBy
            -- ✅ Filter by warehouse via OutwardLine
            WHERE oh.MovementType = 'Consumption'
              AND oh.IsDeleted = 0
              AND EXISTS (
                    SELECT 1 FROM [dbo].[OutwardLine] ol
                    WHERE ol.OutwardHeaderId = oh.id
                      AND ol.FromWarehouseId = @WarehouseId
                      AND ol.IsDeleted = 0
              )
            ORDER BY oh.OutwardDate DESC;

            SELECT 200 AS StatusCode, 'Consumption by warehouse fetched successfully' AS StatusMsg;
        END

    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;

       SELECT 500 AS statuscode,
        CONCAT(
            'SQL Error: ', ERROR_MESSAGE(),
            ' | Line: ', ERROR_LINE(),
            ' | ErrorNo: ', ERROR_NUMBER()
        ) AS StatusMsg;
    END CATCH

END;

##
