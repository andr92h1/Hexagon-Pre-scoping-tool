using Microsoft.EntityFrameworkCore.Migrations;
using NetTopologySuite.Geometries;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

namespace mv.prescoping.db.Migrations
{
    public partial class AddedAnnotation : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Annotations",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Code = table.Column<int>(type: "integer", nullable: false),
                    ClassName = table.Column<string>(type: "text", nullable: false),
                    ConfidentLevel = table.Column<float>(type: "real", nullable: false, defaultValue: 1f),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    IsPassedValidation = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    IsClassChanged = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    IsGeometryChanged = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    Geometry = table.Column<Geometry>(type: "geometry", nullable: false),
                    Label = table.Column<string>(type: "text", nullable: true),
                    ChangeHistory = table.Column<string>(type: "text", nullable: true),
                    Details = table.Column<string>(type: "text", nullable: true),
                    StageId = table.Column<long>(type: "bigint", nullable: true),
                    PhotoId = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Annotations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Annotations_Photos_PhotoId",
                        column: x => x.PhotoId,
                        principalTable: "Photos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Annotations_Stages_StageId",
                        column: x => x.StageId,
                        principalTable: "Stages",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Annotations_PhotoId",
                table: "Annotations",
                column: "PhotoId");

            migrationBuilder.CreateIndex(
                name: "IX_Annotations_StageId",
                table: "Annotations",
                column: "StageId");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Annotations");
        }
    }
}
